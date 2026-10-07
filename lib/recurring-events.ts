import { revalidateTag, unstable_cache } from "next/cache";
import { query } from "./db";
import type { HolidayRow, RecurringEventCycle, RecurringEventRow } from "./db";
import { addDaysToKey, addMonthsToKey, koreaCurrentMonthKey } from "./date";
import { listCoaches } from "./schedule";

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

export interface RecurringEventInput {
  name: string;
  cycle: RecurringEventCycle;
  dayOfMonth: number;
  /** cycle이 'weekly'/'biweekly'일 때만 보낸다. */
  dayOfWeek?: number | null;
  startHour: number;
  endHour: number;
}

export async function createRecurringEvent(
  input: RecurringEventInput,
): Promise<RecurringEventRow> {
  const result = await query<RecurringEventRow>(
    `INSERT INTO recurring_events (name, cycle, day_of_month, day_of_week, start_hour, end_hour)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.name,
      input.cycle,
      input.dayOfMonth,
      input.dayOfWeek ?? null,
      input.startHour,
      input.endHour,
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
 * 활성화된 정기 일정(스터디/독서 모임 등)의 이번 달·다음 달 발생일을 계산해,
 * 아직 스케줄표에 없으면 재직 중인 코치 전원의 해당 시간대를 "개인 일정"
 * 메모 항목으로 채워 넣어 실제로 예약을 막는다. 이미 그 코치·시간대에 다른
 * 일정이 있으면(예: 관리자가 수동으로 지운 뒤 다른 예약을 잡은 경우) 건드리지
 * 않고 건너뛴다. 스케줄표 조회 시점마다 가볍게 호출된다.
 */
export async function ensureRecurringEventSessions(): Promise<void> {
  const events = (await listRecurringEvents()).filter((e) => e.enabled);
  if (events.length === 0) return;

  const currentMonth = koreaCurrentMonthKey();
  const monthKeys = [currentMonth, addMonthsToKey(currentMonth, 1)];

  const [holidaysResult, coaches] = await Promise.all([
    query<HolidayRow>(`SELECT * FROM holidays`),
    listCoaches(true),
  ]);
  if (coaches.length === 0) return;
  const holidaySet = new Set(holidaysResult.rows.map((h) => h.holiday_date));

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

  for (const monthKey of monthKeys) {
    const month = Number(monthKey.slice(5, 7));

    // 이 달에 실제로 발생하는 모든 (일정, 날짜) 쌍을 먼저 모은다. monthly/
    // quarterly는 달마다 한 번, weekly/biweekly는 달마다 여러 번(최대 5번) 나올
    // 수 있다.
    const occurrences: { event: RecurringEventRow; occurrenceDate: string }[] = [];
    for (const event of events) {
      if (event.cycle === "monthly" || event.cycle === "quarterly") {
        if (!CYCLE_MONTHS[event.cycle].includes(month)) continue;
        occurrences.push({
          event,
          occurrenceDate: computeOccurrenceDate(monthKey, event.day_of_month, holidaySet),
        });
      } else {
        for (const occurrenceDate of occurrencesInMonth(monthKey, event, holidaySet)) {
          occurrences.push({ event, occurrenceDate });
        }
      }
    }

    // 같은 날짜에 서로 다른 일정이 겹치면(예: 매달 반복과 분기 반복이 3·6·9·12월에
    // 겹치는 경우) 더 드문 주기가 우선한다.
    const winnerByDate = new Map<string, RecurringEventRow>();
    for (const { event, occurrenceDate } of occurrences) {
      const current = winnerByDate.get(occurrenceDate);
      if (!current || CYCLE_PRIORITY[event.cycle] > CYCLE_PRIORITY[current.cycle]) {
        winnerByDate.set(occurrenceDate, event);
      }
    }

    for (const { event, occurrenceDate } of occurrences) {
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
    winners.map(({ event, occurrenceDate }) =>
      query(
        `INSERT INTO class_sessions (coach_id, session_date, session_hour, memo, entry_type)
         SELECT c, $2::text, h, $4::text, 'memo'
         FROM unnest($1::int[]) AS c, unnest($3::int[]) AS h
         ON CONFLICT (coach_id, session_date, session_hour) DO NOTHING`,
        [coachIds, occurrenceDate, hoursOf(event), event.name],
      ),
    ),
  );
}
