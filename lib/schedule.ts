import { randomBytes } from "crypto";
import { query } from "./db";
import type {
  ClassSessionRow,
  CoachRow,
  HolidayRow,
  MemberRow,
  MemberStatus,
  PackageRow,
  PtType,
  SessionStatus,
} from "./db";
import { addDaysToKey, addMonthsToKey } from "./date";
import { scheduleHoursForWeekday, type DayHours } from "./constants";

// ---- 코치 ----

export async function listCoaches(activeOnly = false): Promise<CoachRow[]> {
  const result = await query<CoachRow>(
    activeOnly
      ? `SELECT * FROM coaches WHERE active = true ORDER BY id ASC`
      : `SELECT * FROM coaches ORDER BY id ASC`,
  );
  return result.rows;
}

export async function addCoach(name: string): Promise<CoachRow> {
  const result = await query<CoachRow>(
    `INSERT INTO coaches (name) VALUES ($1) RETURNING *`,
    [name],
  );
  return result.rows[0];
}

export async function setCoachActive(id: number, active: boolean): Promise<void> {
  await query(`UPDATE coaches SET active = $2 WHERE id = $1`, [id, active]);
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

// ---- 공휴일 ----

export async function listHolidays(): Promise<HolidayRow[]> {
  const result = await query<HolidayRow>(
    `SELECT * FROM holidays ORDER BY holiday_date ASC`,
  );
  return result.rows;
}

export async function addHoliday(date: string, name: string): Promise<void> {
  await query(
    `INSERT INTO holidays (holiday_date, name) VALUES ($1, $2)
     ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name`,
    [date, name],
  );
}

export async function removeHoliday(date: string): Promise<void> {
  await query(`DELETE FROM holidays WHERE holiday_date = $1`, [date]);
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
  }
  if (input.followupMemo !== undefined) {
    fields.push(`followup_memo = $${++i}`);
    values.push(input.followupMemo);
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

export async function listMembers(): Promise<MemberRow[]> {
  const result = await query<MemberRow>(`SELECT * FROM members ORDER BY name ASC`);
  return result.rows;
}

export interface MemberWithProgress extends MemberRow {
  total_sessions: number;
  done_count: number;
  package_count: number;
}

export async function listMembersWithProgress(): Promise<MemberWithProgress[]> {
  const result = await query<MemberWithProgress>(
    `SELECT m.*,
       COALESCE(p.total, 0)::int as total_sessions,
       COALESCE(s.done, 0)::int as done_count,
       COALESCE(p.pkg_count, 0)::int as package_count
     FROM members m
     LEFT JOIN (
       SELECT member_id, SUM(total_sessions) as total, COUNT(*) as pkg_count
       FROM packages GROUP BY member_id
     ) p ON p.member_id = m.id
     LEFT JOIN (
       SELECT member_id, COUNT(*) as done FROM class_sessions
       WHERE status IN ('completed', 'no_show') GROUP BY member_id
     ) s ON s.member_id = m.id
     ORDER BY m.name ASC`,
  );
  return result.rows;
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
): Promise<PackageRow> {
  const result = await query<PackageRow>(
    `INSERT INTO packages (member_id, total_sessions, price, note, pt_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [memberId, totalSessions, price, note, ptType],
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
  input: { totalSessions?: number; price?: number; note?: string; ptType?: PtType },
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
  doneCount: number; // completed + no_show
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
       WHERE member_id = $1 AND status IN ('completed', 'no_show')`,
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
  input: { status?: SessionStatus; memo?: string; coachId?: number; ptType?: PtType },
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

/** 활성 코치 중 담당 회원이 가장 적은 코치를 기본 배정 코치로 고른다 (코치가 1명이면 그 코치). */
async function pickDefaultCoachId(): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT c.id FROM coaches c
     LEFT JOIN members m ON m.coach_id = c.id AND m.status = 'active'
     WHERE c.active = true
     GROUP BY c.id
     ORDER BY COUNT(m.id) ASC, c.id ASC
     LIMIT 1`,
  );
  return result.rows[0]?.id ?? null;
}

/**
 * 연락처로 기존 회원을 찾고, 없으면 새로 만든다. 아직 패키지를 구매하지 않은
 * "상담 대기" 회원을 빠르게 찾거나 등록할 때 쓴다(사전예약 자동 연동, 관리자의
 * 수동 상담 예약 등).
 */
export async function findOrCreateMemberByPhone(input: {
  name: string;
  phone: string;
  coachId: number | null;
  notes?: string;
}): Promise<MemberRow> {
  if (input.phone.trim()) {
    const existing = await query<MemberRow>(
      `SELECT * FROM members WHERE phone = $1 AND phone <> '' LIMIT 1`,
      [input.phone.trim()],
    );
    if (existing.rows[0]) return existing.rows[0];
  }
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

  const member = await findOrCreateMemberByPhone({
    name: input.name,
    phone: input.phone,
    coachId,
    notes: "사전예약 폼을 통해 자동 등록됨",
  });

  try {
    const session = await createSession({
      memberId: member.id,
      coachId: member.coach_id ?? coachId,
      date: input.date,
      hour: input.hour,
      memo: "사전예약 자동 등록",
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
  completedSessions: number;
  noShowCount: number;
  revenue: number;
  reRegisteredCount: number;
  churnedCount: number;
  reRegistrationRate: number | null; // 재등록 / (재등록 + 이탈), 분모 0이면 null
}

/** yearMonth: "YYYY-MM" */
export async function getCoachMonthlyReports(yearMonth: string): Promise<CoachMonthlyReport[]> {
  const monthStart = `${yearMonth}-01`;

  const [coachesResult, revenueResult, sessionsResult, memberStatsResult] = await Promise.all([
    query<CoachRow>(`SELECT * FROM coaches ORDER BY id ASC`),
    query<{ coach_id: number; revenue: string }>(
      `SELECT m.coach_id as coach_id, SUM(p.price) as revenue
       FROM packages p
       JOIN members m ON m.id = p.member_id
       WHERE to_char(p.purchased_at, 'YYYY-MM') = $1 AND m.coach_id IS NOT NULL
       GROUP BY m.coach_id`,
      [yearMonth],
    ),
    query<{ coach_id: number; completed: string; no_show: string }>(
      `SELECT coach_id,
         COUNT(*) FILTER (WHERE status IN ('completed', 'no_show')) as completed,
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
  ]);

  const revenueMap = new Map(revenueResult.rows.map((r) => [r.coach_id, Number(r.revenue ?? 0)]));
  const sessionsMap = new Map(
    sessionsResult.rows.map((r) => [r.coach_id, Number(r.completed ?? 0)]),
  );
  const noShowMap = new Map(sessionsResult.rows.map((r) => [r.coach_id, Number(r.no_show ?? 0)]));
  const memberStatsMap = new Map(memberStatsResult.rows.map((r) => [r.coach_id, r]));

  return coachesResult.rows.map((coach) => {
    const stats = memberStatsMap.get(coach.id);
    const reRegistered = Number(stats?.re_registered ?? 0);
    const churned = Number(stats?.churned ?? 0);
    const denom = reRegistered + churned;
    return {
      coachId: coach.id,
      coachName: coach.name,
      memberCount: Number(stats?.member_count ?? 0),
      completedSessions: sessionsMap.get(coach.id) ?? 0,
      noShowCount: noShowMap.get(coach.id) ?? 0,
      revenue: revenueMap.get(coach.id) ?? 0,
      reRegisteredCount: reRegistered,
      churnedCount: churned,
      reRegistrationRate: denom > 0 ? reRegistered / denom : null,
    };
  });
}

// ---- 관리자 대시보드 개요 ----

export interface DashboardOverview {
  activeMemberCount: number;
  monthlyRevenue: number;
  monthlyCompletedSessions: number;
  monthlyNoShowCount: number;
  noShowRate: number | null;
  monthlyNewMemberCount: number;
  monthlyReRegisteredMemberCount: number;
}

/** yearMonth: "YYYY-MM" */
export async function getDashboardOverview(yearMonth: string): Promise<DashboardOverview> {
  const [activeMembers, revenue, sessionStats, newMembers, reRegistered] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM members WHERE status = 'active'`),
    query<{ revenue: string }>(
      `SELECT COALESCE(SUM(price), 0) as revenue FROM packages
       WHERE to_char(purchased_at, 'YYYY-MM') = $1`,
      [yearMonth],
    ),
    query<{ completed: string; no_show: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
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
  ]);

  const completed = Number(sessionStats.rows[0]?.completed ?? 0);
  const noShow = Number(sessionStats.rows[0]?.no_show ?? 0);
  const denom = completed + noShow;

  return {
    activeMemberCount: Number(activeMembers.rows[0]?.count ?? 0),
    monthlyRevenue: Number(revenue.rows[0]?.revenue ?? 0),
    monthlyCompletedSessions: completed,
    monthlyNoShowCount: noShow,
    noShowRate: denom > 0 ? noShow / denom : null,
    monthlyNewMemberCount: Number(newMembers.rows[0]?.count ?? 0),
    monthlyReRegisteredMemberCount: Number(reRegistered.rows[0]?.count ?? 0),
  };
}

export interface MonthlyTrendPoint {
  month: string; // YYYY-MM
  revenue: number;
  completedSessions: number;
}

/** endYearMonth 기준 최근 `months`개월 치 매출·완료세션 추이 (차트용). */
export async function getMonthlyTrend(
  endYearMonth: string,
  months: number,
): Promise<MonthlyTrendPoint[]> {
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthKeys.push(addMonthsToKey(endYearMonth, -i));
  }

  const [revenueResult, sessionResult] = await Promise.all([
    query<{ month: string; revenue: string }>(
      `SELECT to_char(purchased_at, 'YYYY-MM') as month, SUM(price) as revenue
       FROM packages
       WHERE to_char(purchased_at, 'YYYY-MM') = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
    query<{ month: string; completed: string }>(
      `SELECT LEFT(session_date, 7) as month, COUNT(*) as completed
       FROM class_sessions
       WHERE entry_type = 'session' AND status IN ('completed', 'no_show')
         AND LEFT(session_date, 7) = ANY($1)
       GROUP BY month`,
      [monthKeys],
    ),
  ]);

  const revenueMap = new Map(revenueResult.rows.map((r) => [r.month, Number(r.revenue ?? 0)]));
  const sessionMap = new Map(sessionResult.rows.map((r) => [r.month, Number(r.completed ?? 0)]));

  return monthKeys.map((month) => ({
    month,
    revenue: revenueMap.get(month) ?? 0,
    completedSessions: sessionMap.get(month) ?? 0,
  }));
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
      `SELECT session_date, session_hour FROM class_sessions
       WHERE coach_id = $1 AND session_date >= $2 AND session_date <= $3
         AND status IN ('reserved', 'completed')`,
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
