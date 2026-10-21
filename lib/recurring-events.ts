import { revalidateTag, unstable_cache } from "next/cache";
import { query } from "./db";
import type { HolidayRow, RecurringEventCycle, RecurringEventRow } from "./db";
import { addDaysToKey, addMonthsToKey, koreaCurrentMonthKey } from "./date";
import { listCoaches } from "./schedule";
import { getDailyScheduleMemos, setDailyScheduleMemo } from "./daily-schedule-memos";
import { dailyMemoLineText } from "./daily-memo-checklist";

/** 'monthly'/'quarterly'가 발생하는 월(1~12). 'weekly'/'biweekly'는 달과 무관하게
    매주/격주로 발생해 여기 포함되지 않는다(ensureRecurringEventSessions에서 따로 다룸). */
export const CYCLE_MONTHS: Record<"monthly" | "quarterly", number[]> = {
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  quarterly: [3, 6, 9, 12],
};

export const CYCLE_LABELS: Record<RecurringEventCycle, string> = {
  monthly: "매달",
  quarterly: "분기(3·6·9·12월)",
  weekly: "매주",
  biweekly: "격주",
};

// 같은 날짜에 서로 다른 정기 일정이 겹치면 더 드문 주기가 우선한다(기존
// "매달/분기 겹치면 분기가 우선" 규칙을 매주/격주까지 일관되게 확장).
const CYCLE_PRIORITY: Record<RecurringEventCycle, number> = {
  quarterly: 3,
  monthly: 2,
  biweekly: 1,
  weekly: 0,
};

// 정기 일정도 코치/공휴일처럼 자주 바뀌지 않는 참조성 데이터라 캐싱한다.
export const listRecurringEvents = unstable_cache(
  async (): Promise<RecurringEventRow[]> => {
    const result = await query<RecurringEventRow>(
      `SELECT * FROM recurring_events ORDER BY id ASC`,
    );
    return result.rows;
  },
  ["list-recurring-events"],
  { tags: ["recurring-events"], revalidate: 300 },
);

/** week_of_month에 이 값을 쓰면 "마지막주"를 뜻한다(그 달에 해당 요일이 4번
    있든 5번 있든 항상 가장 마지막 occurrence). */
export const WEEK_OF_MONTH_LAST = 5;

export interface RecurringEventInput {
  name: string;
  cycle: RecurringEventCycle;
  dayOfMonth: number;
  /** cycle이 'weekly'/'biweekly'일 때, 또는 'monthly'/'quarterly'이면서
      weekOfMonth도 함께 보낼 때 쓴다. */
  dayOfWeek?: number | null;
  /** cycle이 'monthly'/'quarterly'일 때만 보낸다. 채워지면 dayOfMonth 대신
      "그 달의 dayOfWeek 요일 중 N번째"(1~4, WEEK_OF_MONTH_LAST=마지막) 패턴으로
      계산한다. */
  weekOfMonth?: number | null;
  startHour: number;
  endHour: number;
  /** true면 스케줄표 시간 칸(개인 일정) 대신 그 날짜의 요일별 메모장에 이름
      한 줄로만 표시한다. */
  asMemo?: boolean;
}

export async function createRecurringEvent(
  input: RecurringEventInput,
): Promise<RecurringEventRow> {
  const result = await query<RecurringEventRow>(
    `INSERT INTO recurring_events (name, cycle, day_of_month, day_of_week, week_of_month, start_hour, end_hour, as_memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      input.name,
      input.cycle,
      input.dayOfMonth,
      input.dayOfWeek ?? null,
      input.weekOfMonth ?? null,
      input.startHour,
      input.endHour,
      input.asMemo ?? false,
    ],
  );
  revalidateTag("recurring-events", { expire: 0 });
  return result.rows[0];
}

export async function updateRecurringEvent(
  id: number,
  patch: Partial<RecurringEventInput> & { enabled?: boolean },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    fields.push(`name = $${++i}`);
    values.push(patch.name);
  }
  if (patch.cycle !== undefined) {
    fields.push(`cycle = $${++i}`);
    values.push(patch.cycle);
  }
  if (patch.dayOfMonth !== undefined) {
    fields.push(`day_of_month = $${++i}`);
    values.push(patch.dayOfMonth);
  }
  if (patch.dayOfWeek !== undefined) {
    fields.push(`day_of_week = $${++i}`);
    values.push(patch.dayOfWeek);
  }
  if (patch.weekOfMonth !== undefined) {
    fields.push(`week_of_month = $${++i}`);
    values.push(patch.weekOfMonth);
  }
  if (patch.startHour !== undefined) {
    fields.push(`start_hour = $${++i}`);
    values.push(patch.startHour);
  }
  if (patch.endHour !== undefined) {
    fields.push(`end_hour = $${++i}`);
    values.push(patch.endHour);
  }
  if (patch.enabled !== undefined) {
    fields.push(`enabled = $${++i}`);
    values.push(patch.enabled);
  }
  if (patch.asMemo !== undefined) {
    fields.push(`as_memo = $${++i}`);
    values.push(patch.asMemo);
  }
  if (fields.length === 0) return;

  await query(`UPDATE recurring_events SET ${fields.join(", ")} WHERE id = $1`, [id, ...values]);
  revalidateTag("recurring-events", { expire: 0 });
}

export async function deleteRecurringEvent(id: number): Promise<void> {
  await query(`DELETE FROM recurring_events WHERE id = $1`, [id]);
  revalidateTag("recurring-events", { expire: 0 });
}

function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일 ... 6=토
}

/** "YYYY-MM-DD" 두 키 사이의 날짜 차이(일수). b가 a보다 늦으면 양수. */
function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

/** 주말이거나 공휴일 관리에 등록된 날이면 다음 날로 계속 미룬 실제 발생일. */
function pushPastWeekendsAndHolidays(date: string, holidaySet: Set<string>): string {
  let d = date;
  while (weekdayOfKey(d) === 0 || weekdayOfKey(d) === 6 || holidaySet.has(d)) {
    d = addDaysToKey(d, 1);
  }
  return d;
}

/** monthKey(YYYY-MM) + dayOfMonth로 시작해, 주말/공휴일이면 다음 날로 계속 미룬 실제 발생일. */
export function computeOccurrenceDate(
  monthKey: string,
  dayOfMonth: number,
  holidaySet: Set<string>,
): string {
  return pushPastWeekendsAndHolidays(`${monthKey}-${String(dayOfMonth).padStart(2, "0")}`, holidaySet);
}

/** 일요일이거나 공휴일 관리에 등록된 날이면 다음 날로 계속 미룬 실제 발생일.
    pushPastWeekendsAndHolidays와 달리 토요일은 건너뛰지 않는다 — "N째주 요일"
    패턴에서 고른 요일이 토요일이면, 토요일은 당직 코치가 운영하는 정식 영업일이라
    평일로 밀지 않고 그대로 쓴다. */
function pushPastSundaysAndHolidays(date: string, holidaySet: Set<string>): string {
  let d = date;
  while (weekdayOfKey(d) === 0 || holidaySet.has(d)) {
    d = addDaysToKey(d, 1);
  }
  return d;
}

/** monthKey(YYYY-MM) 안에서 요일이 dayOfWeek인 날짜들 중 weekOfMonth번째
    (1~4) 또는 마지막(WEEK_OF_MONTH_LAST)에 해당하는 날짜. 일요일/공휴일이면
    다음 날로 민다(토요일은 그대로 둔다). 예: weekOfMonth=1, dayOfWeek=3이면
    "그 달의 첫째주 수요일". */
export function computeNthWeekdayOccurrence(
  monthKey: string,
  dayOfWeek: number,
  weekOfMonth: number,
  holidaySet: Set<string>,
): string {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const matches: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${monthKey}-${String(d).padStart(2, "0")}`;
    if (weekdayOfKey(key) === dayOfWeek) matches.push(key);
  }
  const index = weekOfMonth === WEEK_OF_MONTH_LAST ? matches.length - 1 : weekOfMonth - 1;
  const chosen = matches[Math.min(Math.max(index, 0), matches.length - 1)];
  return pushPastSundaysAndHolidays(chosen, holidaySet);
}

/** monthKey(YYYY-MM) 안에서 'weekly'/'biweekly' 정기 일정이 실제 발생하는 날짜들.
    'biweekly'는 정기 일정을 등록한 날짜(created_at)를 1주차로 삼아 2주에 한 번만
    걸러낸다 — 등록일 기준이라 새로 만든 격주 일정은 그 주부터 바로 시작된다. */
function occurrencesInMonth(
  monthKey: string,
  event: RecurringEventRow,
  holidaySet: Set<string>,
): string[] {
  if (event.day_of_week == null) return [];
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // created_at은 RecurringEventRow 타입상 string이지만, 이 함수는 JSON 직렬화를
  // 거치지 않고 pg 드라이버 결과를 그대로 받는 서버 쪽 경로라 실제로는 Date
  // 인스턴스로 온다 — new Date(...)로 한 번 더 감싸야 문자열이든 Date든 안전하다.
  const createdDateKey = new Date(event.created_at).toISOString().slice(0, 10);

  const dates = new Set<string>();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${monthKey}-${String(d).padStart(2, "0")}`;
    if (weekdayOfKey(key) !== event.day_of_week) continue;
    if (event.cycle === "biweekly") {
      const weeksSince = Math.floor(daysBetweenKeys(createdDateKey, key) / 7);
      if (((weeksSince % 2) + 2) % 2 !== 0) continue;
    }
    dates.add(pushPastWeekendsAndHolidays(key, holidaySet));
  }
  return Array.from(dates);
}

/**
 * 활성화된 정기 일정(스터디/독서 모임 등)의 이번 달·다음 달 발생일을 계산해
 * 반영한다. as_memo가 false면(기본) 재직 중인 코치 전원의 해당 시간대를
 * "개인 일정" 메모 항목으로 채워 넣어 실제로 예약을 막고, true면 시간 칸 대신
 * 그 날짜의 요일별 메모장(daily_schedule_memos)에 이름을 한 줄만 추가한다.
 * 이미 그 코치·시간대에 다른 일정이 있으면(예: 관리자가 수동으로 지운 뒤
 * 다른 예약을 잡은 경우) 건드리지 않고 건너뛴다. 관리자가 아무것도 다시
 * 채우지 않고 그냥 지우기만 한 경우에는(=칸이 비어있음) recurring_event_skips에
 * 기록된 "건너뛸 발생"이 없는지 확인해, 있으면 그 날짜·코치만 다시 채우지
 * 않는다(skipRecurringOccurrence 참고). 스케줄표 조회 시점마다 가볍게 호출된다.
 */
export async function ensureRecurringEventSessions(): Promise<void> {
  const events = (await listRecurringEvents()).filter((e) => e.enabled);
  if (events.length === 0) return;

  const currentMonth = koreaCurrentMonthKey();
  const monthKeys = [currentMonth, addMonthsToKey(currentMonth, 1)];

  const [holidaysResult, coaches, skipsResult] = await Promise.all([
    query<HolidayRow>(`SELECT * FROM holidays`),
    listCoaches(true),
    query<{ event_id: number; occurrence_date: string; coach_id: number }>(
      `SELECT event_id, occurrence_date, coach_id FROM recurring_event_skips`,
    ),
  ]);
  if (coaches.length === 0) return;
  const holidaySet = new Set(holidaysResult.rows.map((h) => h.holiday_date));
  const skipSet = new Set(
    skipsResult.rows.map((r) => `${r.event_id}:${r.occurrence_date}:${r.coach_id}`),
  );

  const coachIds = coaches.map((c) => c.id);
  const hoursOf = (event: RecurringEventRow) =>
    Array.from({ length: event.end_hour - event.start_hour }, (_, i) => event.start_hour + i);

  // 승자(이번에 스케줄표에 남을 일정)의 INSERT는 진 일정의 DELETE가 전부
  // 끝난 뒤에만 실행해야 한다 — 먼저 넣으면 그 순간 자리가 안 비어있어
  // ON CONFLICT DO NOTHING에 막혀 승자 자신도 못 들어가는 문제가 있었다.
  // 이 선후관계만 지키면, 서로 다른 일정끼리는(달이 다르든 같은 달의 다른
  // 날짜든) 독립적이라 굳이 하나씩 순차로 왕복할 필요가 없다 — 진 일정
  // DELETE를 한 번에 병렬로 보내고, 그 다음 승자 INSERT를 한 번에 병렬로
  // 보낸다(달×일정 개수만큼 순차 왕복하던 것을 최대 2번의 왕복으로 줄임).
  const losers: { event: RecurringEventRow; occurrenceDate: string }[] = [];
  const winners: { event: RecurringEventRow; occurrenceDate: string }[] = [];
  // 메모형 일정은 시간 칸을 두고 경쟁하지 않는다 — 텍스트 한 줄일 뿐이라 같은
  // 날짜에 여러 메모형 일정이 겹쳐도 문제없으므로, 승자/패자 판정 없이 계산된
  // 발생일 전부를 그대로 쓴다.
  const memoOccurrences: { event: RecurringEventRow; occurrenceDate: string }[] = [];

  for (const monthKey of monthKeys) {
    const month = Number(monthKey.slice(5, 7));

    // 이 달에 실제로 발생하는 모든 (일정, 날짜) 쌍을 먼저 모은다. monthly/
    // quarterly는 달마다 한 번, weekly/biweekly는 달마다 여러 번(최대 5번) 나올
    // 수 있다.
    const scheduleOccurrences: { event: RecurringEventRow; occurrenceDate: string }[] = [];
    for (const event of events) {
      const dates =
        event.cycle === "monthly" || event.cycle === "quarterly"
          ? CYCLE_MONTHS[event.cycle].includes(month)
            ? [
                event.week_of_month != null && event.day_of_week != null
                  ? computeNthWeekdayOccurrence(monthKey, event.day_of_week, event.week_of_month, holidaySet)
                  : computeOccurrenceDate(monthKey, event.day_of_month, holidaySet),
              ]
            : []
          : occurrencesInMonth(monthKey, event, holidaySet);

      for (const occurrenceDate of dates) {
        if (event.as_memo) {
          memoOccurrences.push({ event, occurrenceDate });
        } else {
          scheduleOccurrences.push({ event, occurrenceDate });
        }
      }
    }

    // 같은 날짜에 서로 다른 시간 칸 일정이 겹치면(예: 매달 반복과 분기 반복이
    // 3·6·9·12월에 겹치는 경우) 더 드문 주기가 우선한다.
    const winnerByDate = new Map<string, RecurringEventRow>();
    for (const { event, occurrenceDate } of scheduleOccurrences) {
      const current = winnerByDate.get(occurrenceDate);
      if (!current || CYCLE_PRIORITY[event.cycle] > CYCLE_PRIORITY[current.cycle]) {
        winnerByDate.set(occurrenceDate, event);
      }
    }

    for (const { event, occurrenceDate } of scheduleOccurrences) {
      if (winnerByDate.get(occurrenceDate)?.id === event.id) {
        winners.push({ event, occurrenceDate });
      } else {
        losers.push({ event, occurrenceDate });
      }
    }
  }

  await Promise.all(
    losers.map(({ event, occurrenceDate }) =>
      query(
        `DELETE FROM class_sessions
         WHERE coach_id = ANY($1::int[]) AND session_date = $2 AND session_hour = ANY($3::int[])
           AND entry_type = 'memo' AND memo = $4`,
        [coachIds, occurrenceDate, hoursOf(event), event.name],
      ),
    ),
  );

  await Promise.all(
    winners.map(({ event, occurrenceDate }) => {
      const allowedCoachIds = coachIds.filter(
        (coachId) => !skipSet.has(`${event.id}:${occurrenceDate}:${coachId}`),
      );
      if (allowedCoachIds.length === 0) return Promise.resolve();
      return query(
        `INSERT INTO class_sessions (coach_id, session_date, session_hour, memo, entry_type)
         SELECT c, $2::text, h, $4::text, 'memo'
         FROM unnest($1::int[]) AS c, unnest($3::int[]) AS h
         ON CONFLICT (coach_id, session_date, session_hour) DO NOTHING`,
        [allowedCoachIds, occurrenceDate, hoursOf(event), event.name],
      );
    }),
  );

  if (memoOccurrences.length > 0) {
    const memoDates = Array.from(new Set(memoOccurrences.map((m) => m.occurrenceDate)));
    const existingMemos = await getDailyScheduleMemos(memoDates);
    const linesByDate = new Map<string, string[]>();
    for (const date of memoDates) {
      linesByDate.set(
        date,
        (existingMemos[date] ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0),
      );
    }
    // 이미 같은 이름의 줄이 있으면(체크 여부·체크박스 표시 유무와 무관하게)
    // 중복 추가하지 않고, 관리자가 직접 적어둔 다른 줄은 그대로 둔다.
    for (const { event, occurrenceDate } of memoOccurrences) {
      const lines = linesByDate.get(occurrenceDate)!;
      if (!lines.some((l) => dailyMemoLineText(l) === event.name)) lines.push(event.name);
    }
    await Promise.all(
      Array.from(linesByDate.entries())
        .filter(([date, lines]) => lines.join("\n") !== (existingMemos[date] ?? ""))
        .map(([date, lines]) => setDailyScheduleMemo(date, lines.join("\n"))),
    );
  }
}

/**
 * 정기 일정이 자동으로 채워 넣은 메모 칸(entry_type='memo', memo === 정기
 * 일정 이름)을 관리자가 지웠을 때 호출한다. 지워진 메모 텍스트와 이름이
 * 같은 활성 정기 일정이 있으면, 그 날짜·코치 조합을 "건너뛸 발생"으로
 * 기록해 다음 ensureRecurringEventSessions 실행에서 자리가 다시 채워지지
 * 않게 한다. 일치하는 정기 일정이 없으면(관리자가 직접 적은 일반 메모)
 * 아무 일도 하지 않는다.
 */
export async function skipRecurringOccurrence(
  memoText: string,
  occurrenceDate: string,
  coachId: number,
): Promise<void> {
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM recurring_events WHERE enabled AND as_memo = false AND name = $1`,
    [memoText],
  );
  await Promise.all(
    rows.map((row) =>
      query(
        `INSERT INTO recurring_event_skips (event_id, occurrence_date, coach_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, occurrence_date, coach_id) DO NOTHING`,
        [row.id, occurrenceDate, coachId],
      ),
    ),
  );
}
