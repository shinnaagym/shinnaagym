import { randomBytes } from "crypto";
import { query } from "./db";
import type {
  ClassSessionRow,
  CoachRow,
  HolidayRow,
  MemberRow,
  MemberStatus,
  PackageRow,
  SessionStatus,
} from "./db";
import { addDaysToKey } from "./date";
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
}

export async function createMember(input: MemberInput): Promise<MemberRow> {
  const result = await query<MemberRow>(
    `INSERT INTO members (name, phone, coach_id, notes, token)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name, input.phone, input.coachId, input.notes, generateMemberToken()],
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
  if (input.status !== undefined) {
    fields.push(`status = $${++i}`);
    values.push(input.status);
  }
  if (fields.length === 0) return;

  await query(`UPDATE members SET ${fields.join(", ")} WHERE id = $1`, [id, ...values]);
}

export async function listMembers(): Promise<MemberRow[]> {
  const result = await query<MemberRow>(`SELECT * FROM members ORDER BY name ASC`);
  return result.rows;
}

export interface MemberWithProgress extends MemberRow {
  total_sessions: number;
  done_count: number;
}

export async function listMembersWithProgress(): Promise<MemberWithProgress[]> {
  const result = await query<MemberWithProgress>(
    `SELECT m.*,
       COALESCE(p.total, 0)::int as total_sessions,
       COALESCE(s.done, 0)::int as done_count
     FROM members m
     LEFT JOIN (
       SELECT member_id, SUM(total_sessions) as total FROM packages GROUP BY member_id
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
): Promise<PackageRow> {
  const result = await query<PackageRow>(
    `INSERT INTO packages (member_id, total_sessions, price, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [memberId, totalSessions, price, note],
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
  member_name: string;
  coach_name: string;
}

export async function listSessionsInRange(
  fromKey: string,
  toKey: string,
): Promise<SessionWithMember[]> {
  const result = await query<SessionWithMember>(
    `SELECT s.*, m.name as member_name, c.name as coach_name
     FROM class_sessions s
     JOIN members m ON m.id = s.member_id
     JOIN coaches c ON c.id = s.coach_id
     WHERE s.session_date >= $1 AND s.session_date <= $2
     ORDER BY s.session_date ASC, s.session_hour ASC`,
    [fromKey, toKey],
  );
  return result.rows;
}

export async function listMemberSessions(memberId: number): Promise<SessionWithMember[]> {
  const result = await query<SessionWithMember>(
    `SELECT s.*, m.name as member_name, c.name as coach_name
     FROM class_sessions s
     JOIN members m ON m.id = s.member_id
     JOIN coaches c ON c.id = s.coach_id
     WHERE s.member_id = $1
     ORDER BY s.session_date DESC, s.session_hour DESC`,
    [memberId],
  );
  return result.rows;
}

export async function createSession(input: {
  memberId: number;
  coachId: number;
  date: string;
  hour: number;
  memo?: string;
}): Promise<ClassSessionRow> {
  const result = await query<ClassSessionRow>(
    `INSERT INTO class_sessions (member_id, coach_id, session_date, session_hour, memo)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.memberId, input.coachId, input.date, input.hour, input.memo ?? ""],
  );
  return result.rows[0];
}

export async function updateSession(
  id: number,
  input: { status?: SessionStatus; memo?: string; coachId?: number },
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
  if (fields.length === 0) return;

  await query(`UPDATE class_sessions SET ${fields.join(", ")} WHERE id = $1`, [
    id,
    ...values,
  ]);
}

export async function deleteSession(id: number): Promise<void> {
  await query(`DELETE FROM class_sessions WHERE id = $1`, [id]);
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
