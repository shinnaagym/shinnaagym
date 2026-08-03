import { randomBytes } from "crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { query, UNIQUE_VIOLATION } from "./db";
import type {
  ClassSessionRow,
  CoachRow,
  EmploymentType,
  FixedSlotRow,
  HolidayRow,
  MemberRow,
  MemberStatus,
  PackageRow,
  PaymentMethod,
  PtType,
  SessionStatus,
} from "./db";
import { addDaysToKey, addMonthsToKey, koreaCurrentHour, koreaTodayKey } from "./date";
import { scheduleHoursForWeekday, type DayHours } from "./constants";

// ---- 코치 ----

// 코치 목록은 거의 바뀌지 않는 참조성 데이터라, 관리자 페이지를 오갈 때마다
// 매번 다시 조회하지 않도록 캐싱한다. 실제로 코치 정보가 바뀌면(추가/재직상태/
// 연락처 변경) 아래 mutate 함수들이 즉시 revalidateTag로 캐시를 무효화한다.
export const listCoaches = unstable_cache(
  async (activeOnly = false): Promise<CoachRow[]> => {
    const result = await query<CoachRow>(
      activeOnly
        ? `SELECT * FROM coaches WHERE active = true ORDER BY id ASC`
        : `SELECT * FROM coaches ORDER BY id ASC`,
    );
    return result.rows;
  },
  ["list-coaches"],
  { tags: ["coaches"], revalidate: 300 },
);

export async function addCoach(name: string, phone = ""): Promise<CoachRow> {
  const result = await query<CoachRow>(
    `INSERT INTO coaches (name, phone) VALUES ($1, $2) RETURNING *`,
    [name, phone],
  );
  revalidateTag("coaches", { expire: 0 });
  return result.rows[0];
}

export async function setCoachActive(id: number, active: boolean): Promise<void> {
  await query(`UPDATE coaches SET active = $2 WHERE id = $1`, [id, active]);
  revalidateTag("coaches", { expire: 0 });
}

export async function setCoachPhone(id: number, phone: string): Promise<void> {
  await query(`UPDATE coaches SET phone = $2 WHERE id = $1`, [id, phone]);
  revalidateTag("coaches", { expire: 0 });
}

export async function setCoachBirthday(id: number, birthday: string): Promise<void> {
  await query(`UPDATE coaches SET birthday = $2 WHERE id = $1`, [id, birthday]);
  revalidateTag("coaches", { expire: 0 });
}

export async function setCoachEmploymentInfo(
  id: number,
  info: { employmentType: EmploymentType; hiredAt: string; isTeamLead: boolean },
): Promise<void> {
  await query(
    `UPDATE coaches SET employment_type = $2, hired_at = $3, is_team_lead = $4 WHERE id = $1`,
    [id, info.employmentType, info.hiredAt, info.isTeamLead],
  );
  revalidateTag("coaches", { expire: 0 });
}

/** 코치별 담당 활성 회원 수 (퇴사 처리 전 경고용). */
export async function getActiveMemberCountsByCoach(): Promise<Record<number, number>> {
  const result = await query<{ coach_id: number; count: string }>(
    `SELECT coach_id, COUNT(*) as count FROM members
     WHERE coach_id IS NOT NULL AND status = 'active'
     GROUP BY coach_id`,
  );
  return Object.fromEntries(result.rows.map((r) => [r.coach_id, Number(r.count)]));
}

// ---- 당직자(요일별 고정 담당 코치) ----

// 공휴일·코치 목록처럼 자주 바뀌지 않는 참조성 데이터라 같은 방식으로 캐싱한다.
// weekday: 0=월요일 ~ 6=일요일.
export const getDutyRoster = unstable_cache(
  async (): Promise<Record<number, { coachId: number; coachName: string }>> => {
    const result = await query<{ weekday: number; coach_id: number; coach_name: string }>(
      `SELECT d.weekday, d.coach_id, c.name AS coach_name
       FROM duty_roster d JOIN coaches c ON c.id = d.coach_id`,
    );
    return Object.fromEntries(
      result.rows.map((r) => [r.weekday, { coachId: r.coach_id, coachName: r.coach_name }]),
    );
  },
  ["duty-roster"],
  { tags: ["duty-roster"], revalidate: 300 },
);

/** coachId가 null이면 해당 요일의 당직 지정을 해제한다. */
export async function setDutyAssignment(weekday: number, coachId: number | null): Promise<void> {
  if (coachId === null) {
    await query(`DELETE FROM duty_roster WHERE weekday = $1`, [weekday]);
  } else {
    await query(
      `INSERT INTO duty_roster (weekday, coach_id) VALUES ($1, $2)
       ON CONFLICT (weekday) DO UPDATE SET coach_id = EXCLUDED.coach_id`,
      [weekday, coachId],
    );
  }
  revalidateTag("duty-roster", { expire: 0 });
}

export interface DutyOverride {
  coachId: number | null;
  coachName: string | null;
}

/** 특정 날짜들에 대한 당직 예외(이번 주만 변경 등)를 조회한다. 캐싱하지
    않는다 — 스케줄표를 볼 때마다 실시간으로 반영돼야 한다. */
export async function getDutyOverridesForDates(
  dateKeys: string[],
): Promise<Record<string, DutyOverride>> {
  if (dateKeys.length === 0) return {};
  const result = await query<{ override_date: string; coach_id: number | null; coach_name: string | null }>(
    `SELECT o.override_date, o.coach_id, c.name AS coach_name
     FROM duty_overrides o LEFT JOIN coaches c ON c.id = o.coach_id
     WHERE o.override_date = ANY($1)`,
    [dateKeys],
  );
  return Object.fromEntries(
    result.rows.map((r) => [r.override_date, { coachId: r.coach_id, coachName: r.coach_name }]),
  );
}

/** coachId가 undefined면 이 날짜의 예외 지정을 완전히 지워 요일 기본값으로
    되돌린다. null이면 "이 날짜는 당직자 없음"을 명시적으로 저장한다. */
export async function setDutyOverride(
  date: string,
  coachId: number | null | undefined,
): Promise<void> {
  if (coachId === undefined) {
    await query(`DELETE FROM duty_overrides WHERE override_date = $1`, [date]);
  } else {
    await query(
      `INSERT INTO duty_overrides (override_date, coach_id) VALUES ($1, $2)
       ON CONFLICT (override_date) DO UPDATE SET coach_id = EXCLUDED.coach_id`,
      [date, coachId],
    );
  }
}

// ---- 코치별 근무시간(평일/토요일) ----

export interface CoachWorkingHours {
  weekdayStart: number;
  weekdayEnd: number;
  saturdayStart: number;
  saturdayEnd: number;
}

// 코치 목록과 마찬가지로 자주 바뀌지 않는 참조성 데이터라 캐싱한다.
export const getCoachWorkingHours = unstable_cache(
  async (): Promise<Record<number, CoachWorkingHours>> => {
    const result = await query<{
      coach_id: number;
      weekday_start: number;
      weekday_end: number;
      saturday_start: number;
      saturday_end: number;
    }>(`SELECT * FROM coach_working_hours`);
    return Object.fromEntries(
      result.rows.map((r) => [
        r.coach_id,
        {
          weekdayStart: r.weekday_start,
          weekdayEnd: r.weekday_end,
          saturdayStart: r.saturday_start,
          saturdayEnd: r.saturday_end,
        },
      ]),
    );
  },
  ["coach-working-hours"],
  { tags: ["coach-working-hours"], revalidate: 300 },
);

/** hours가 null이면 그 코치의 근무시간 제한을 지워 "제한 없음"으로 되돌린다. */
export async function setCoachWorkingHours(
  coachId: number,
  hours: CoachWorkingHours | null,
): Promise<void> {
  if (hours === null) {
    await query(`DELETE FROM coach_working_hours WHERE coach_id = $1`, [coachId]);
  } else {
    await query(
      `INSERT INTO coach_working_hours (coach_id, weekday_start, weekday_end, saturday_start, saturday_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (coach_id) DO UPDATE SET
         weekday_start = EXCLUDED.weekday_start, weekday_end = EXCLUDED.weekday_end,
         saturday_start = EXCLUDED.saturday_start, saturday_end = EXCLUDED.saturday_end`,
      [coachId, hours.weekdayStart, hours.weekdayEnd, hours.saturdayStart, hours.saturdayEnd],
    );
  }
  revalidateTag("coach-working-hours", { expire: 0 });
}

// ---- 공휴일 ----

// 공휴일도 코치 목록과 마찬가지로 자주 바뀌지 않는 참조성 데이터라 캐싱한다.
export const listHolidays = unstable_cache(
  async (): Promise<HolidayRow[]> => {
    const result = await query<HolidayRow>(
      `SELECT * FROM holidays ORDER BY holiday_date ASC`,
    );
    return result.rows;
  },
  ["list-holidays"],
  { tags: ["holidays"], revalidate: 300 },
);

export async function addHoliday(date: string, name: string): Promise<void> {
  await query(
    `INSERT INTO holidays (holiday_date, name) VALUES ($1, $2)
     ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name`,
    [date, name],
  );
  revalidateTag("holidays", { expire: 0 });
}

export async function removeHoliday(date: string): Promise<void> {
  await query(`DELETE FROM holidays WHERE holiday_date = $1`, [date]);
  revalidateTag("holidays", { expire: 0 });
}

/** dateKey(YYYY-MM-DD) 요일 + 공휴일 여부를 반영한 실제 운영시간. */
export async function getDayHours(dateKey: string): Promise<DayHours> {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const holidayResult = await query<HolidayRow>(
    `SELECT 1 FROM holidays WHERE holiday_date = $1`,
    [dateKey],
  );
  return scheduleHoursForWeekday(weekday, holidayResult.rows.length > 0);
}

/** 여러 날짜의 운영시간을 한 번의 공휴일 조회로 계산 (그리드 렌더링용). */
export async function getDayHoursForRange(
  dateKeys: string[],
): Promise<Record<string, DayHours>> {
  const result = await query<HolidayRow>(
    `SELECT * FROM holidays WHERE holiday_date = ANY($1)`,
    [dateKeys],
  );
  const holidaySet = new Set(result.rows.map((r) => r.holiday_date));
  const map: Record<string, DayHours> = {};
  for (const key of dateKeys) {
    const [y, m, d] = key.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    map[key] = scheduleHoursForWeekday(weekday, holidaySet.has(key));
  }
  return map;
}

// ---- 회원 & 세션권 ----

function generateMemberToken(): string {
  return randomBytes(9).toString("base64url");
}

export interface MemberInput {
  name: string;
  phone: string;
  coachId: number | null;
  notes: string;
  referrer?: string;
  availableTimes?: string;
  followupStatus?: string;
  followupMemo?: string;
  improvementDirection?: string;
}

export async function createMember(input: MemberInput): Promise<MemberRow> {
  const result = await query<MemberRow>(
    `INSERT INTO members (name, phone, coach_id, notes, referrer, available_times, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      input.name,
      input.phone,
      input.coachId,
      input.notes,
      input.referrer ?? "",
      input.availableTimes ?? "",
      generateMemberToken(),
    ],
  );
  return result.rows[0];
}

export async function updateMember(
  id: number,
  input: Partial<MemberInput> & { status?: MemberStatus },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${++i}`);
    values.push(input.name);
  }
  if (input.phone !== undefined) {
    fields.push(`phone = $${++i}`);
    values.push(input.phone);
  }
  if (input.coachId !== undefined) {
    fields.push(`coach_id = $${++i}`);
    values.push(input.coachId);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${++i}`);
    values.push(input.notes);
  }
  if (input.referrer !== undefined) {
    fields.push(`referrer = $${++i}`);
    values.push(input.referrer);
  }
  if (input.availableTimes !== undefined) {
    fields.push(`available_times = $${++i}`);
    values.push(input.availableTimes);
  }
  if (input.followupStatus !== undefined) {
    fields.push(`followup_status = $${++i}`);
    values.push(input.followupStatus);
    fields.push(`followup_updated_at = now()`);
  }
  if (input.followupMemo !== undefined) {
    fields.push(`followup_memo = $${++i}`);
    values.push(input.followupMemo);
  }
  if (input.improvementDirection !== undefined) {
    fields.push(`improvement_direction = $${++i}`);
    values.push(input.improvementDirection);
  }
  if (input.status !== undefined) {
    fields.push(`status = $${++i}`);
    values.push(input.status);
  }
  if (fields.length === 0) return;

  await query(`UPDATE members SET ${fields.join(", ")} WHERE id = $1`, [id, ...values]);
}

/** 패키지가 하나도 없는(=결제 이력 없는) 회원만 완전 삭제를 허용한다. */
export async function deleteMember(id: number): Promise<void> {
  await query(`DELETE FROM members WHERE id = $1`, [id]);
}

/** 오늘(포함) 이후로 예정된 이 회원의 예약을 전부 지우고, 지운 행을 그대로 반환한다
    (회원 삭제 처리의 일부 — 실행취소용 스냅샷). 회원이 없어졌으니 해당 시간대는
    다른 회원이 다시 예약할 수 있도록 비워준다. */
export async function deleteUpcomingSessionsForMember(
  memberId: number,
  todayKey: string,
): Promise<ClassSessionRow[]> {
  const result = await query<ClassSessionRow>(
    `DELETE FROM class_sessions WHERE member_id = $1 AND session_date >= $2 RETURNING *`,
    [memberId, todayKey],
  );
  return result.rows;
}

/** 이 회원의 지난 예약 id 목록(오늘 이전). 회원을 삭제해도 정산 기록으로 남기지만
    (member_id는 NULL로), 실행취소 시 member_id를 되돌리려면 미리 id를 알아둬야 한다. */
export async function listPastSessionIdsForMember(
  memberId: number,
  todayKey: string,
): Promise<number[]> {
  const result = await query<{ id: number }>(
    `SELECT id FROM class_sessions WHERE member_id = $1 AND session_date < $2`,
    [memberId, todayKey],
  );
  return result.rows.map((r) => r.id);
}

export async function listMembers(): Promise<MemberRow[]> {
  const result = await query<MemberRow>(`SELECT * FROM members ORDER BY name ASC`);
  return result.rows;
}

export interface MemberWithProgress extends MemberRow {
  total_sessions: number;
  done_count: number;
  package_count: number;
  has_next_week_session: boolean;
  latest_pt_type: PtType;
}

export async function listMembersWithProgress(
  nextWeekStart?: string,
  nextWeekEnd?: string,
): Promise<MemberWithProgress[]> {
  const result = await query<MemberWithProgress>(
    `SELECT m.*,
       COALESCE(p.total, 0)::int as total_sessions,
       COALESCE(s.done, 0)::int as done_count,
       COALESCE(p.pkg_count, 0)::int as package_count,
       (nw.member_id IS NOT NULL) as has_next_week_session,
       COALESCE(lp.pt_type, '1:1') as latest_pt_type
     FROM members m
     LEFT JOIN (
       SELECT member_id, SUM(total_sessions) as total, COUNT(*) as pkg_count
       FROM packages GROUP BY member_id
     ) p ON p.member_id = m.id
     LEFT JOIN (
       SELECT member_id, COUNT(*) as done FROM class_sessions
       WHERE entry_type = 'session' AND status <> 'cancelled' GROUP BY member_id
     ) s ON s.member_id = m.id
     LEFT JOIN (
       SELECT DISTINCT member_id FROM class_sessions
       WHERE entry_type = 'session' AND status <> 'cancelled'
         AND session_date >= $1 AND session_date <= $2
     ) nw ON nw.member_id = m.id
     LEFT JOIN (
       SELECT DISTINCT ON (member_id) member_id, pt_type
       FROM packages
       ORDER BY member_id, purchased_at DESC
     ) lp ON lp.member_id = m.id
     ORDER BY m.name ASC`,
    [nextWeekStart ?? "9999-12-31", nextWeekEnd ?? "9999-12-31"],
  );
  return result.rows;
}

// ---- 고정 시간대 ----

export interface FixedSlotWithMember extends FixedSlotRow {
  member_name: string;
  member_coach_id: number | null;
}

export async function listFixedSlots(): Promise<FixedSlotWithMember[]> {
  const result = await query<FixedSlotWithMember>(
    `SELECT f.*, m.name as member_name, m.coach_id as member_coach_id
     FROM fixed_slots f
     JOIN members m ON m.id = f.member_id
     ORDER BY f.weekday ASC, f.hour ASC, m.name ASC`,
  );
  return result.rows;
}

export async function listFixedSlotsByMember(memberId: number): Promise<FixedSlotRow[]> {
  const result = await query<FixedSlotRow>(
    `SELECT * FROM fixed_slots WHERE member_id = $1 ORDER BY weekday ASC, hour ASC`,
    [memberId],
  );
  return result.rows;
}

export async function addFixedSlot(
  memberId: number,
  weekday: number,
  hour: number,
): Promise<FixedSlotRow> {
  const result = await query<FixedSlotRow>(
    `INSERT INTO fixed_slots (member_id, weekday, hour)
     VALUES ($1, $2, $3)
     ON CONFLICT (member_id, weekday, hour) DO UPDATE SET member_id = EXCLUDED.member_id
     RETURNING *`,
    [memberId, weekday, hour],
  );
  return result.rows[0];
}

export async function removeFixedSlot(id: number): Promise<void> {
  await query(`DELETE FROM fixed_slots WHERE id = $1`, [id]);
}

/** 회원의 가장 최근 결제 패키지의 PT 유형(없으면 1:1). */
async function getLatestPtType(memberId: number): Promise<PtType> {
  const result = await query<{ pt_type: PtType }>(
    `SELECT pt_type FROM packages WHERE member_id = $1 ORDER BY purchased_at DESC LIMIT 1`,
    [memberId],
  );
  return result.rows[0]?.pt_type ?? "1:1";
}

/** 아직 스케줄표에 예약으로 배정되지 않은 잔여 회차 수(= 잔여 회차 - 이미 잡힌 건수). */
async function getUnallocatedSessionCount(memberId: number): Promise<number> {
  const result = await query<{ total: string | null; taken: string }>(
    `SELECT
       (SELECT COALESCE(SUM(total_sessions), 0) FROM packages WHERE member_id = $1) as total,
       (SELECT COUNT(*) FROM class_sessions
          WHERE member_id = $1 AND entry_type = 'session' AND status <> 'cancelled') as taken`,
    [memberId],
  );
  const row = result.rows[0];
  const total = Number(row?.total ?? 0);
  const taken = Number(row?.taken ?? 0);
  return Math.max(0, total - taken);
}

/** YYYY-MM-DD 날짜의 요일을 0=월 ... 6=일 인덱스로 변환 (fixed_slots.weekday와 동일한 규칙). */
function mondayIndexedWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일 ... 6=토
  return jsDay === 0 ? 6 : jsDay - 1;
}

export interface FixedSlotBackfillResult {
  slot: FixedSlotRow;
  created: number;
  skippedDates: string[];
  createdSessionIds: number[];
}

/**
 * 고정 시간대를 추가하고, 그 요일·시간에 회원의 잔여(미배정) 회차만큼 스케줄표에
 * 실제 주간 반복 예약을 자동 생성한다. 이미 예약이 있는 주는 건너뛰고 계속 다음
 * 주로 넘어가 목표 건수를 채운다(최대 2년치까지만 시도).
 */
export async function addFixedSlotWithBackfill(
  memberId: number,
  weekday: number,
  hour: number,
): Promise<FixedSlotBackfillResult> {
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error("회원을 찾을 수 없습니다.");
  }
  if (!member.coach_id) {
    throw new Error("담당 코치를 먼저 지정해주세요.");
  }

  // 한 시간대에는 코치당 회원 한 명만 고정 배정할 수 있다.
  const conflict = await query<{ member_name: string }>(
    `SELECT m.name as member_name FROM fixed_slots f
     JOIN members m ON m.id = f.member_id
     WHERE m.coach_id = $1 AND f.weekday = $2 AND f.hour = $3 AND f.member_id <> $4`,
    [member.coach_id, weekday, hour, memberId],
  );
  if (conflict.rows.length > 0) {
    throw new Error(`이미 이 시간대에 ${conflict.rows[0].member_name} 회원이 배정되어 있어요.`);
  }

  const slot = await addFixedSlot(memberId, weekday, hour);

  const unallocated = await getUnallocatedSessionCount(memberId);
  if (unallocated <= 0) {
    return { slot, created: 0, skippedDates: [], createdSessionIds: [] };
  }

  const ptType = await getLatestPtType(memberId);
  const todayKey = koreaTodayKey();
  const todayWeekday = mondayIndexedWeekday(todayKey);

  let offset = (weekday - todayWeekday + 7) % 7;
  if (offset === 0 && hour <= koreaCurrentHour()) {
    offset = 7;
  }
  let candidateDate = addDaysToKey(todayKey, offset);

  let created = 0;
  const skippedDates: string[] = [];
  const createdSessionIds: number[] = [];
  const MAX_ATTEMPTS = 104; // 최대 2년치까지만 시도(무한 루프 방지)
  let attempts = 0;

  while (created < unallocated && attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const createdSession = await createSession({
        memberId,
        coachId: member.coach_id,
        date: candidateDate,
        hour,
        entryType: "session",
        ptType,
      });
      createdSessionIds.push(createdSession.id);
      created += 1;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === UNIQUE_VIOLATION) {
        skippedDates.push(candidateDate);
      } else {
        throw err;
      }
    }
    candidateDate = addDaysToKey(candidateDate, 7);
  }

  return { slot, created, skippedDates, createdSessionIds };
}

export async function getMemberById(id: number): Promise<MemberRow | null> {
  const result = await query<MemberRow>(`SELECT * FROM members WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getMemberByToken(token: string): Promise<MemberRow | null> {
  const result = await query<MemberRow>(`SELECT * FROM members WHERE token = $1`, [
    token,
  ]);
  return result.rows[0] ?? null;
}

export async function addPackage(
  memberId: number,
  totalSessions: number,
  price: number,
  note: string,
  ptType: PtType = "1:1",
  paymentMethod: PaymentMethod = "card",
): Promise<PackageRow> {
  const result = await query<PackageRow>(
    `INSERT INTO packages (member_id, total_sessions, price, note, pt_type, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [memberId, totalSessions, price, note, ptType, paymentMethod],
  );
  return result.rows[0];
}

export async function listPackages(memberId: number): Promise<PackageRow[]> {
  const result = await query<PackageRow>(
    `SELECT * FROM packages WHERE member_id = $1 ORDER BY purchased_at ASC`,
    [memberId],
  );
  return result.rows;
}

export async function updatePackage(
  id: number,
  input: {
    totalSessions?: number;
    price?: number;
    note?: string;
    ptType?: PtType;
    paymentMethod?: PaymentMethod;
  },
): Promise<PackageRow> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.totalSessions !== undefined) {
    fields.push(`total_sessions = $${++i}`);
    values.push(input.totalSessions);
  }
  if (input.price !== undefined) {
    fields.push(`price = $${++i}`);
    values.push(input.price);
  }
  if (input.note !== undefined) {
    fields.push(`note = $${++i}`);
    values.push(input.note);
  }
  if (input.ptType !== undefined) {
    fields.push(`pt_type = $${++i}`);
    values.push(input.ptType);
  }
  if (input.paymentMethod !== undefined) {
    fields.push(`payment_method = $${++i}`);
    values.push(input.paymentMethod);
  }

  const result = await query<PackageRow>(
    `UPDATE packages SET ${fields.join(", ")} WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  return result.rows[0];
}

export async function deletePackage(id: number): Promise<void> {
  await query(`DELETE FROM packages WHERE id = $1`, [id]);
}

export interface MemberProgress {
  totalSessions: number;
  doneCount: number; // 취소 제외 전체 수업 수(예약 포함)
  remaining: number;
}

export async function computeMemberProgress(memberId: number): Promise<MemberProgress> {
  const [packagesResult, doneResult] = await Promise.all([
    query<{ sum: string | null }>(
      `SELECT SUM(total_sessions) as sum FROM packages WHERE member_id = $1`,
      [memberId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM class_sessions
       WHERE member_id = $1 AND entry_type = 'session' AND status <> 'cancelled'`,
      [memberId],
    ),
  ]);
  const totalSessions = Number(packagesResult.rows[0]?.sum ?? 0);
  const doneCount = Number(doneResult.rows[0]?.count ?? 0);
  return { totalSessions, doneCount, remaining: totalSessions - doneCount };
}

// ---- 수업 세션 ----

export interface SessionWithMember extends ClassSessionRow {
  member_name: string | null;
  coach_name: string;
  // 이 세션이 그 회원의 몇 번째 세션인지(취소 제외, 예약 포함), 그리고 현재까지 구매한 총 회차.
  ordinal: number | null;
  total_sessions: number | null;
}

const SESSION_SELECT_FIELDS = `
  s.*, m.name as member_name, c.name as coach_name,
  (CASE WHEN s.member_id IS NULL THEN NULL ELSE (
    SELECT COUNT(*) FROM class_sessions s2
    WHERE s2.member_id = s.member_id AND s2.status <> 'cancelled'
      AND (s2.session_date, s2.session_hour) <= (s.session_date, s.session_hour)
  ) END) as ordinal,
  (CASE WHEN s.member_id IS NULL THEN NULL ELSE (
    SELECT COALESCE(SUM(p.total_sessions), 0) FROM packages p WHERE p.member_id = s.member_id
  ) END) as total_sessions
`;

export interface CoachScheduleStats {
  monthPt: number;
  monthPair: number;
  weekPt: number;
  weekPair: number;
  monthConsultation: number;
  monthNoShowSession: number;
  monthNoShowConsultation: number;
}

/** 스케줄표에서 코치 한 명을 선택했을 때 KPI 카드에 쓰는 코치별 통계(이번 달/이번 주). */
export async function getAllCoachScheduleStats(
  monthKey: string,
  weekStart: string,
  weekEnd: string,
): Promise<Map<number, CoachScheduleStats>> {
  const result = await query<{
    coach_id: number;
    month_pt: string;
    month_pair: string;
    week_pt: string;
    week_pair: string;
    month_consultation: string;
    month_no_show_session: string;
    month_no_show_consultation: string;
  }>(
    `SELECT coach_id,
       COUNT(*) FILTER (WHERE entry_type = 'session' AND pt_type = '1:1' AND status <> 'cancelled' AND LEFT(session_date, 7) = $1) as month_pt,
       COUNT(*) FILTER (WHERE entry_type = 'session' AND pt_type = '2:1' AND status <> 'cancelled' AND LEFT(session_date, 7) = $1) as month_pair,
       COUNT(*) FILTER (WHERE entry_type = 'session' AND pt_type = '1:1' AND status <> 'cancelled' AND session_date >= $2 AND session_date <= $3) as week_pt,
       COUNT(*) FILTER (WHERE entry_type = 'session' AND pt_type = '2:1' AND status <> 'cancelled' AND session_date >= $2 AND session_date <= $3) as week_pair,
       COUNT(*) FILTER (WHERE entry_type = 'consultation' AND status NOT IN ('cancelled', 'no_show') AND LEFT(session_date, 7) = $1) as month_consultation,
       COUNT(*) FILTER (WHERE entry_type = 'session' AND status = 'no_show' AND LEFT(session_date, 7) = $1) as month_no_show_session,
       COUNT(*) FILTER (WHERE entry_type = 'consultation' AND status = 'no_show' AND LEFT(session_date, 7) = $1) as month_no_show_consultation
     FROM class_sessions
     GROUP BY coach_id`,
    [monthKey, weekStart, weekEnd],
  );
  const map = new Map<number, CoachScheduleStats>();
  for (const row of result.rows) {
    map.set(row.coach_id, {
      monthPt: Number(row.month_pt),
      monthPair: Number(row.month_pair),
      weekPt: Number(row.week_pt),
      weekPair: Number(row.week_pair),
      monthConsultation: Number(row.month_consultation),
      monthNoShowSession: Number(row.month_no_show_session),
      monthNoShowConsultation: Number(row.month_no_show_consultation),
    });
  }
  return map;
}

export async function listSessionsInRange(
  fromKey: string,
  toKey: string,
): Promise<SessionWithMember[]> {
  const result = await query<SessionWithMember>(
    `SELECT ${SESSION_SELECT_FIELDS}
     FROM class_sessions s
     LEFT JOIN members m ON m.id = s.member_id
     JOIN coaches c ON c.id = s.coach_id
     WHERE s.session_date >= $1 AND s.session_date <= $2
     ORDER BY s.session_date ASC, s.session_hour ASC`,
    [fromKey, toKey],
  );
  return result.rows;
}

export async function listMemberSessions(memberId: number): Promise<SessionWithMember[]> {
  const result = await query<SessionWithMember>(
    `SELECT ${SESSION_SELECT_FIELDS}
     FROM class_sessions s
     LEFT JOIN members m ON m.id = s.member_id
     JOIN coaches c ON c.id = s.coach_id
     WHERE s.member_id = $1
     ORDER BY s.session_date DESC, s.session_hour DESC`,
    [memberId],
  );
  return result.rows;
}

export async function createSession(input: {
  memberId: number | null;
  coachId: number;
  date: string;
  hour: number;
  memo?: string;
  entryType?: "session" | "consultation" | "memo" | "blocked";
  ptType?: PtType;
}): Promise<ClassSessionRow> {
  const result = await query<ClassSessionRow>(
    `INSERT INTO class_sessions (member_id, coach_id, session_date, session_hour, memo, entry_type, pt_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      input.memberId,
      input.coachId,
      input.date,
      input.hour,
      input.memo ?? "",
      input.entryType ?? "session",
      input.ptType ?? "1:1",
    ],
  );
  return result.rows[0];
}

export async function updateSession(
  id: number,
  input: {
    status?: SessionStatus;
    memo?: string;
    coachId?: number;
    ptType?: PtType;
    sessionDate?: string;
    sessionHour?: number;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.status !== undefined) {
    fields.push(`status = $${++i}`);
    values.push(input.status);
  }
  if (input.memo !== undefined) {
    fields.push(`memo = $${++i}`);
    values.push(input.memo);
  }
  if (input.coachId !== undefined) {
    fields.push(`coach_id = $${++i}`);
    values.push(input.coachId);
  }
  if (input.ptType !== undefined) {
    fields.push(`pt_type = $${++i}`);
    values.push(input.ptType);
  }
  if (input.sessionDate !== undefined) {
    fields.push(`session_date = $${++i}`);
    values.push(input.sessionDate);
  }
  if (input.sessionHour !== undefined) {
    fields.push(`session_hour = $${++i}`);
    values.push(input.sessionHour);
  }
  if (fields.length === 0) return;

  await query(`UPDATE class_sessions SET ${fields.join(", ")} WHERE id = $1`, [
    id,
    ...values,
  ]);
}

export async function deleteSession(id: number): Promise<void> {
  await query(`DELETE FROM class_sessions WHERE id = $1`, [id]);
}

// ---- 사전예약 → 스케줄표 자동 연동 ----

/**
 * 사전예약 스케줄 연동은 '신종수' 코치의 시간표 칸만 빌려 쓴다. 다른 코치로
 * 대체하는 조건은 전혀 없다 — 이름에 '신종수'가 들어간 코치를 대소문자/공백
 * 관계없이 찾아 그 코치로만 배정하고(활성 여부도 따지지 않음), 그 코치
 * 자체를 못 찾을 때만 null을 반환해 스케줄 연동을 건너뛴다. 다른 코치로
 * 조용히 새는 경로는 없다.
 */
async function pickDefaultCoachId(): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT id FROM coaches WHERE name ILIKE '%신종수%' ORDER BY id ASC LIMIT 1`,
  );
  return result.rows[0]?.id ?? null;
}

/** 연락처로 기존 회원을 조회한다(빈 연락처는 조회하지 않고 null). */
export async function getMemberByPhone(phone: string): Promise<MemberRow | null> {
  if (!phone.trim()) return null;
  const result = await query<MemberRow>(
    `SELECT * FROM members WHERE phone = $1 AND phone <> '' LIMIT 1`,
    [phone.trim()],
  );
  return result.rows[0] ?? null;
}

/**
 * 연락처로 기존 회원을 찾고, 없으면 새로 만든다. 아직 패키지를 구매하지 않은
 * "상담 대기" 회원을 빠르게 찾거나 등록할 때 쓴다(사전예약 자동 연동, 관리자의
 * 수동 상담 예약, 초진 문진표/평가지 즉석 작성 등).
 */
export async function findOrCreateMemberByPhone(input: {
  name: string;
  phone: string;
  coachId: number | null;
  notes?: string;
}): Promise<MemberRow> {
  const existing = await getMemberByPhone(input.phone);
  if (existing) return existing;
  return createMember({
    name: input.name,
    phone: input.phone,
    coachId: input.coachId,
    notes: input.notes ?? "",
  });
}

/**
 * 공개 사전예약 폼에서 예약이 들어오면 회원(연락처로 조회, 없으면 신규 등록)과
 * 스케줄표 세션을 자동으로 만들어 관리자가 스케줄표에서 바로 볼 수 있게 한다.
 */
export async function linkPreReservationToSchedule(input: {
  name: string;
  phone: string;
  date: string;
  hour: number;
}): Promise<{ memberId: number; sessionId: number } | null> {
  const coachId = await pickDefaultCoachId();
  if (!coachId) return null; // 활성 코치가 없으면 연동을 건너뛴다.

  // 회원의 담당 코치는 관리자가 직접 지정하기 전까지 미지정으로 둔다.
  // coachId는 스케줄표에 임시로 잡아둘 칸(신종수 코치 시간표)을 고를 때만
  // 쓰고, 회원 레코드 자체에는 저장하지 않는다.
  const member = await findOrCreateMemberByPhone({
    name: input.name,
    phone: input.phone,
    coachId: null,
    notes: "사전예약 폼을 통해 자동 등록됨",
  });

  try {
    const session = await createSession({
      memberId: member.id,
      coachId: member.coach_id ?? coachId,
      date: input.date,
      hour: input.hour,
      memo: `사전예약 자동 등록 (${input.phone})`,
      entryType: "consultation",
    });
    return { memberId: member.id, sessionId: session.id };
  } catch {
    // 같은 코치의 같은 시간대가 이미 차 있는 등 스케줄 연동에 실패해도
    // 사전예약 자체는 이미 접수된 상태이므로 조용히 넘어간다.
    return { memberId: member.id, sessionId: -1 };
  }
}

// ---- 코치별 매출 · 재등록율 리포트 ----

export interface CoachMonthlyReport {
  coachId: number;
  coachName: string;
  memberCount: number;
  sessionCount: number;
  sessionCount1on1: number;
  sessionCount2on1: number;
  noShowCount: number;
  revenue: number;
  reRegisteredCount: number;
  churnedCount: number;
  reRegistrationRate: number | null; // 재등록 / (재등록 + 이탈), 분모 0이면 null
  consultationCount: number; // 그 달에 상담한 서로 다른 사람 수
  consultationSuccessRate: number | null; // 그 중 (기간 제한 없이) 결제까지 이어진 비율, 분모 0이면 null
}

/** yearMonth: "YYYY-MM" */
export async function getCoachMonthlyReports(yearMonth: string): Promise<CoachMonthlyReport[]> {
  const monthStart = `${yearMonth}-01`;

  const [coachesResult, revenueResult, sessionsResult, memberStatsResult, consultationResult] =
    await Promise.all([
      query<CoachRow>(`SELECT * FROM coaches ORDER BY id ASC`),
      query<{ coach_id: number; revenue: string }>(
        `SELECT m.coach_id as coach_id, SUM(p.price) as revenue
         FROM packages p
         JOIN members m ON m.id = p.member_id
         WHERE to_char(p.purchased_at, 'YYYY-MM') = $1 AND m.coach_id IS NOT NULL
         GROUP BY m.coach_id`,
        [yearMonth],
      ),
      query<{
        coach_id: number;
        session_count: string;
        session_count_1on1: string;
        session_count_2on1: string;
        no_show: string;
      }>(
        `SELECT coach_id,
           COUNT(*) FILTER (WHERE status <> 'cancelled') as session_count,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND pt_type = '1:1') as session_count_1on1,
           COUNT(*) FILTER (WHERE status <> 'cancelled' AND pt_type = '2:1') as session_count_2on1,
           COUNT(*) FILTER (WHERE status = 'no_show') as no_show
         FROM class_sessions
         WHERE entry_type = 'session'
           AND session_date >= $1 AND session_date < to_char((to_date($1, 'YYYY-MM-DD') + interval '1 month'), 'YYYY-MM-DD')
         GROUP BY coach_id`,
        [monthStart],
      ),
      query<{
        coach_id: number;
        member_count: string;
        re_registered: string;
        churned: string;
      }>(
        `SELECT m.coach_id as coach_id,
           COUNT(*) as member_count,
           COUNT(*) FILTER (WHERE pkg.package_count >= 2) as re_registered,
           COUNT(*) FILTER (WHERE m.status = 'inactive' AND COALESCE(pkg.package_count, 0) < 2) as churned
         FROM members m
         LEFT JOIN (
           SELECT member_id, COUNT(*) as package_count FROM packages GROUP BY member_id
         ) pkg ON pkg.member_id = m.id
         WHERE m.coach_id IS NOT NULL
         GROUP BY m.coach_id`,
      ),
      query<{ coach_id: number; consultation_count: string; success_count: string }>(
        `SELECT cs.coach_id,
           COUNT(DISTINCT cs.member_id) as consultation_count,
           COUNT(DISTINCT cs.member_id) FILTER (
             WHERE EXISTS (SELECT 1 FROM packages p WHERE p.member_id = cs.member_id)
           ) as success_count
         FROM class_sessions cs
         WHERE cs.entry_type = 'consultation' AND cs.status NOT IN ('cancelled', 'no_show')
           AND cs.member_id IS NOT NULL
           AND LEFT(cs.session_date, 7) = $1
         GROUP BY cs.coach_id`,
        [yearMonth],
      ),
    ]);

  const revenueMap = new Map(revenueResult.rows.map((r) => [r.coach_id, Number(r.revenue ?? 0)]));
  const sessionsMap = new Map(
    sessionsResult.rows.map((r) => [r.coach_id, Number(r.session_count ?? 0)]),
  );
  const sessions1on1Map = new Map(
    sessionsResult.rows.map((r) => [r.coach_id, Number(r.session_count_1on1 ?? 0)]),
  );
  const sessions2on1Map = new Map(
    sessionsResult.rows.map((r) => [r.coach_id, Number(r.session_count_2on1 ?? 0)]),
  );
  const noShowMap = new Map(sessionsResult.rows.map((r) => [r.coach_id, Number(r.no_show ?? 0)]));
  const memberStatsMap = new Map(memberStatsResult.rows.map((r) => [r.coach_id, r]));
  const consultationMap = new Map(consultationResult.rows.map((r) => [r.coach_id, r]));

  return coachesResult.rows.map((coach) => {
    const stats = memberStatsMap.get(coach.id);
    const reRegistered = Number(stats?.re_registered ?? 0);
    const churned = Number(stats?.churned ?? 0);
    const denom = reRegistered + churned;
    const consultation = consultationMap.get(coach.id);
    const consultationCount = Number(consultation?.consultation_count ?? 0);
    const consultationSuccessCount = Number(consultation?.success_count ?? 0);
    return {
      coachId: coach.id,
      coachName: coach.name,
      memberCount: Number(stats?.member_count ?? 0),
      sessionCount: sessionsMap.get(coach.id) ?? 0,
      sessionCount1on1: sessions1on1Map.get(coach.id) ?? 0,
      sessionCount2on1: sessions2on1Map.get(coach.id) ?? 0,
      noShowCount: noShowMap.get(coach.id) ?? 0,
      revenue: revenueMap.get(coach.id) ?? 0,
      reRegisteredCount: reRegistered,
      churnedCount: churned,
      reRegistrationRate: denom > 0 ? reRegistered / denom : null,
      consultationCount,
      consultationSuccessRate: consultationCount > 0 ? consultationSuccessCount / consultationCount : null,
    };
  });
}

// ---- 관리자 대시보드 개요 ----

export interface DashboardOverview {
  activeMemberCount: number;
  monthlyRevenueCard: number;
  monthlyRevenueTransfer: number;
  monthlyNoShowCount: number;
  noShowRate: number | null;
  monthlyNewMemberCount: number;
  monthlyReRegisteredMemberCount: number;
  monthlyConsultationCount: number;
}

/** yearMonth: "YYYY-MM" */
export async function getDashboardOverview(yearMonth: string): Promise<DashboardOverview> {
  const [activeMembers, revenue, sessionStats, newMembers, reRegistered, consultations] =
    await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM members WHERE status = 'active'`),
      query<{ payment_method: PaymentMethod; revenue: string }>(
        `SELECT payment_method, COALESCE(SUM(price), 0) as revenue FROM packages
         WHERE to_char(purchased_at, 'YYYY-MM') = $1
         GROUP BY payment_method`,
        [yearMonth],
      ),
      query<{ total: string; no_show: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status <> 'cancelled') as total,
           COUNT(*) FILTER (WHERE status = 'no_show') as no_show
         FROM class_sessions
         WHERE entry_type = 'session' AND LEFT(session_date, 7) = $1`,
        [yearMonth],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM (
           SELECT member_id, MIN(purchased_at) as first_at FROM packages GROUP BY member_id
         ) f WHERE to_char(f.first_at, 'YYYY-MM') = $1`,
        [yearMonth],
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT p.member_id) as count FROM packages p
         WHERE to_char(p.purchased_at, 'YYYY-MM') = $1
           AND p.purchased_at <> (
             SELECT MIN(p2.purchased_at) FROM packages p2 WHERE p2.member_id = p.member_id
           )`,
        [yearMonth],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM class_sessions
         WHERE entry_type = 'consultation' AND status NOT IN ('cancelled', 'no_show')
           AND LEFT(session_date, 7) = $1`,
        [yearMonth],
      ),
    ]);

  const noShow = Number(sessionStats.rows[0]?.no_show ?? 0);
  const denom = Number(sessionStats.rows[0]?.total ?? 0);
  const revenueByMethod = new Map(
    revenue.rows.map((r) => [r.payment_method, Number(r.revenue ?? 0)]),
  );

  return {
    activeMemberCount: Number(activeMembers.rows[0]?.count ?? 0),
    monthlyRevenueCard: revenueByMethod.get("card") ?? 0,
    monthlyRevenueTransfer: revenueByMethod.get("transfer") ?? 0,
    monthlyNoShowCount: noShow,
    noShowRate: denom > 0 ? noShow / denom : null,
    monthlyNewMemberCount: Number(newMembers.rows[0]?.count ?? 0),
    monthlyReRegisteredMemberCount: Number(reRegistered.rows[0]?.count ?? 0),
    monthlyConsultationCount: Number(consultations.rows[0]?.count ?? 0),
  };
}

export interface MonthlyTrendPoint {
  month: string; // YYYY-MM
  revenue: number;
  sessionCount: number;
  consultationCount: number;
}

/** endYearMonth 기준 최근 `months`개월 치 매출·수업수·상담수 추이 (차트용). */
export async function getMonthlyTrend(
  endYearMonth: string,
  months: number,
): Promise<MonthlyTrendPoint[]> {
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthKeys.push(addMonthsToKey(endYearMonth, -i));
  }

  const [revenueResult, sessionResult, consultationResult] = await Promise.all([
    query<{ month: string; revenue: string }>(
      `SELECT to_char(purchased_at, 'YYYY-MM') as month, SUM(price) as revenue
       FROM packages
       WHERE to_char(purchased_at, 'YYYY-MM') = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
    // "수업수"는 스케줄표 KPI와 동일한 정의: 취소되지 않은 수업(완료·노쇼·예정 포함) 건수.
    query<{ month: string; count: string }>(
      `SELECT LEFT(session_date, 7) as month, COUNT(*) as count
       FROM class_sessions
       WHERE entry_type = 'session' AND status <> 'cancelled'
         AND LEFT(session_date, 7) = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
    query<{ month: string; count: string }>(
      `SELECT LEFT(session_date, 7) as month, COUNT(*) as count
       FROM class_sessions
       WHERE entry_type = 'consultation' AND status NOT IN ('cancelled', 'no_show')
         AND LEFT(session_date, 7) = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
  ]);

  const revenueMap = new Map(revenueResult.rows.map((r) => [r.month, Number(r.revenue ?? 0)]));
  const sessionMap = new Map(sessionResult.rows.map((r) => [r.month, Number(r.count ?? 0)]));
  const consultationMap = new Map(
    consultationResult.rows.map((r) => [r.month, Number(r.count ?? 0)]),
  );

  return monthKeys.map((month) => ({
    month,
    revenue: revenueMap.get(month) ?? 0,
    sessionCount: sessionMap.get(month) ?? 0,
    consultationCount: consultationMap.get(month) ?? 0,
  }));
}

// ---- 재등록 관리 ----

export interface MonthlyRetentionPoint {
  month: string; // YYYY-MM
  newMemberCount: number;
  reRegisteredCount: number;
  churnedCount: number;
  reRegistrationRate: number | null; // 재등록 / (재등록 + 이탈), 분모 0이면 null
}

/**
 * endYearMonth 기준 최근 `months`개월 치 신규 등록·재등록·이탈 추이.
 * 신규/재등록은 패키지 구매 이력(최초 구매=신규, 이후 구매=재등록) 기준이고,
 * 이탈은 관리자가 팔로업 상태를 "이탈"로 직접 처리한 시점(followup_updated_at) 기준이다.
 */
export async function getMonthlyRetentionStats(
  endYearMonth: string,
  months: number,
): Promise<MonthlyRetentionPoint[]> {
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthKeys.push(addMonthsToKey(endYearMonth, -i));
  }

  const [newResult, reRegisteredResult, churnedResult] = await Promise.all([
    query<{ month: string; count: string }>(
      `SELECT to_char(f.first_at, 'YYYY-MM') as month, COUNT(*) as count
       FROM (SELECT member_id, MIN(purchased_at) as first_at FROM packages GROUP BY member_id) f
       WHERE to_char(f.first_at, 'YYYY-MM') = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
    query<{ month: string; count: string }>(
      `SELECT to_char(p.purchased_at, 'YYYY-MM') as month, COUNT(DISTINCT p.member_id) as count
       FROM packages p
       WHERE to_char(p.purchased_at, 'YYYY-MM') = ANY($1)
         AND p.purchased_at <> (
           SELECT MIN(p2.purchased_at) FROM packages p2 WHERE p2.member_id = p.member_id
         )
       GROUP BY month`,
      [monthKeys],
    ),
    query<{ month: string; count: string }>(
      `SELECT to_char(followup_updated_at, 'YYYY-MM') as month, COUNT(*) as count
       FROM members
       WHERE followup_status = '이탈' AND to_char(followup_updated_at, 'YYYY-MM') = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
  ]);

  const newMap = new Map(newResult.rows.map((r) => [r.month, Number(r.count ?? 0)]));
  const reRegisteredMap = new Map(
    reRegisteredResult.rows.map((r) => [r.month, Number(r.count ?? 0)]),
  );
  const churnedMap = new Map(churnedResult.rows.map((r) => [r.month, Number(r.count ?? 0)]));

  return monthKeys.map((month) => {
    const reRegisteredCount = reRegisteredMap.get(month) ?? 0;
    const churnedCount = churnedMap.get(month) ?? 0;
    const denom = reRegisteredCount + churnedCount;
    return {
      month,
      newMemberCount: newMap.get(month) ?? 0,
      reRegisteredCount,
      churnedCount,
      reRegistrationRate: denom > 0 ? reRegisteredCount / denom : null,
    };
  });
}

export interface CoachRetentionReport {
  coachId: number;
  coachName: string;
  monthReRegisteredCount: number;
  periodReRegisteredCount: number;
  periodChurnedCount: number;
  reRegistrationRate: number | null; // periodReRegisteredCount / (periodReRegisteredCount + periodChurnedCount)
}

/** endYearMonth 기준 최근 `months`개월 치 코치별 재등록·이탈 건수(재등록 관리 페이지용). */
export async function getCoachRetentionReports(
  endYearMonth: string,
  months: number,
): Promise<CoachRetentionReport[]> {
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthKeys.push(addMonthsToKey(endYearMonth, -i));
  }

  const [coachesResult, monthReRegisteredResult, periodReRegisteredResult, periodChurnedResult] =
    await Promise.all([
      query<CoachRow>(`SELECT * FROM coaches ORDER BY id ASC`),
      query<{ coach_id: number; count: string }>(
        `SELECT m.coach_id as coach_id, COUNT(*) as count
         FROM packages p
         JOIN members m ON m.id = p.member_id
         WHERE to_char(p.purchased_at, 'YYYY-MM') = $1
           AND m.coach_id IS NOT NULL
           AND p.purchased_at <> (
             SELECT MIN(p2.purchased_at) FROM packages p2 WHERE p2.member_id = p.member_id
           )
         GROUP BY m.coach_id`,
        [endYearMonth],
      ),
      query<{ coach_id: number; count: string }>(
        `SELECT m.coach_id as coach_id, COUNT(*) as count
         FROM packages p
         JOIN members m ON m.id = p.member_id
         WHERE to_char(p.purchased_at, 'YYYY-MM') = ANY($1)
           AND m.coach_id IS NOT NULL
           AND p.purchased_at <> (
             SELECT MIN(p2.purchased_at) FROM packages p2 WHERE p2.member_id = p.member_id
           )
         GROUP BY m.coach_id`,
        [monthKeys],
      ),
      query<{ coach_id: number; count: string }>(
        `SELECT coach_id, COUNT(*) as count
         FROM members
         WHERE followup_status = '이탈' AND to_char(followup_updated_at, 'YYYY-MM') = ANY($1)
           AND coach_id IS NOT NULL
         GROUP BY coach_id`,
        [monthKeys],
      ),
    ]);

  const monthReRegisteredMap = new Map(
    monthReRegisteredResult.rows.map((r) => [r.coach_id, Number(r.count ?? 0)]),
  );
  const periodReRegisteredMap = new Map(
    periodReRegisteredResult.rows.map((r) => [r.coach_id, Number(r.count ?? 0)]),
  );
  const periodChurnedMap = new Map(
    periodChurnedResult.rows.map((r) => [r.coach_id, Number(r.count ?? 0)]),
  );

  return coachesResult.rows.map((coach) => {
    const periodReRegisteredCount = periodReRegisteredMap.get(coach.id) ?? 0;
    const periodChurnedCount = periodChurnedMap.get(coach.id) ?? 0;
    const denom = periodReRegisteredCount + periodChurnedCount;
    return {
      coachId: coach.id,
      coachName: coach.name,
      monthReRegisteredCount: monthReRegisteredMap.get(coach.id) ?? 0,
      periodReRegisteredCount,
      periodChurnedCount,
      reRegistrationRate: denom > 0 ? periodReRegisteredCount / denom : null,
    };
  });
}

export interface NewRegistration {
  memberId: number;
  memberName: string;
  coachName: string;
  firstPurchasedAt: string;
}

/** 이번 달에 첫 패키지를 구매한(=신규 등록) 회원 목록. */
export async function listNewRegistrations(yearMonth: string): Promise<NewRegistration[]> {
  const result = await query<{
    member_id: number;
    member_name: string;
    coach_name: string | null;
    first_at: string;
  }>(
    `SELECT f.member_id, m.name as member_name, c.name as coach_name, f.first_at
     FROM (
       SELECT member_id, MIN(purchased_at) as first_at FROM packages GROUP BY member_id
     ) f
     JOIN members m ON m.id = f.member_id
     LEFT JOIN coaches c ON c.id = m.coach_id
     WHERE to_char(f.first_at, 'YYYY-MM') = $1
     ORDER BY f.first_at ASC`,
    [yearMonth],
  );
  return result.rows.map((r) => ({
    memberId: r.member_id,
    memberName: r.member_name,
    coachName: r.coach_name ?? "미배정",
    firstPurchasedAt: r.first_at,
  }));
}

export interface PackagePurchaseEntry {
  id: number;
  purchasedAt: string;
  memberName: string;
  coachName: string | null;
  totalSessions: number;
  price: number;
  isFirst: boolean;
}

/** 이번 달 패키지 결제 내역 (신규/재등록 여부 포함). */
export async function listPackagePurchases(yearMonth: string): Promise<PackagePurchaseEntry[]> {
  const result = await query<{
    id: number;
    purchased_at: string;
    member_name: string;
    coach_name: string | null;
    total_sessions: number;
    price: number;
    is_first: boolean;
  }>(
    `SELECT p.id, p.purchased_at, m.name as member_name, c.name as coach_name,
       p.total_sessions, p.price,
       (p.purchased_at = (
         SELECT MIN(p2.purchased_at) FROM packages p2 WHERE p2.member_id = p.member_id
       )) as is_first
     FROM packages p
     JOIN members m ON m.id = p.member_id
     LEFT JOIN coaches c ON c.id = m.coach_id
     WHERE to_char(p.purchased_at, 'YYYY-MM') = $1
     ORDER BY p.purchased_at DESC`,
    [yearMonth],
  );
  return result.rows.map((r) => ({
    id: r.id,
    purchasedAt: r.purchased_at,
    memberName: r.member_name,
    coachName: r.coach_name,
    totalSessions: Number(r.total_sessions),
    price: Number(r.price),
    isFirst: r.is_first,
  }));
}

/** 회원 화면용: 담당 코치의 향후 N일 가능/마감 시간대 (다른 회원 이름은 노출하지 않음). */
export interface AvailabilityDay {
  date: string;
  closed: boolean;
  slots: { hour: number; available: boolean }[];
}

export async function getCoachAvailability(
  coachId: number,
  fromKey: string,
  days: number,
): Promise<AvailabilityDay[]> {
  const dateKeys = Array.from({ length: days }, (_, i) => addDaysToKey(fromKey, i));
  const toKey = dateKeys[dateKeys.length - 1];

  const [hoursMap, sessionsResult] = await Promise.all([
    getDayHoursForRange(dateKeys),
    query<{ session_date: string; session_hour: number }>(
      // 개인 일정(memo)은 코치의 사적인 메모일 뿐이라 회원에게는 마감으로
      // 보이지 않아야 한다. 실제 예약(session/consultation)과 수업 불가만
      // 마감으로 취급한다.
      `SELECT session_date, session_hour FROM class_sessions
       WHERE coach_id = $1 AND session_date >= $2 AND session_date <= $3
         AND status <> 'cancelled' AND entry_type <> 'memo'`,
      [coachId, fromKey, toKey],
    ),
  ]);

  const takenSet = new Set(
    sessionsResult.rows.map((r) => `${r.session_date}-${r.session_hour}`),
  );

  return dateKeys.map((date) => {
    const hours = hoursMap[date];
    if (hours.closed) return { date, closed: true, slots: [] };
    const slots = Array.from({ length: hours.end - hours.start }, (_, i) => {
      const hour = hours.start + i;
      return { hour, available: !takenSet.has(`${date}-${hour}`) };
    });
    return { date, closed: false, slots };
  });
}
