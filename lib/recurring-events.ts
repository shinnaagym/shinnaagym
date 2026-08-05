import { revalidateTag, unstable_cache } from "next/cache";
import { query } from "./db";
import type { HolidayRow, RecurringEventCycle, RecurringEventRow } from "./db";
import { addDaysToKey, addMonthsToKey, koreaCurrentMonthKey } from "./date";
import { listCoaches } from "./schedule";

/** cycle별로 발생하는 월(1~12). 'monthly'는 매달, 'quarterly'는 3·6·9·12월. */
export const CYCLE_MONTHS: Record<RecurringEventCycle, number[]> = {
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  quarterly: [3, 6, 9, 12],
};

export const CYCLE_LABELS: Record<RecurringEventCycle, string> = {
  monthly: "매달",
  quarterly: "분기(3·6·9·12월)",
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
  startHour: number;
  endHour: number;
}

export async function createRecurringEvent(
  input: RecurringEventInput,
): Promise<RecurringEventRow> {
  const result = await query<RecurringEventRow>(
    `INSERT INTO recurring_events (name, cycle, day_of_month, start_hour, end_hour)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name, input.cycle, input.dayOfMonth, input.startHour, input.endHour],
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

/** monthKey(YYYY-MM) + dayOfMonth로 시작해, 주말/공휴일이면 다음 날로 계속 미룬 실제 발생일. */
export function computeOccurrenceDate(
  monthKey: string,
  dayOfMonth: number,
  holidaySet: Set<string>,
): string {
  let date = `${monthKey}-${String(dayOfMonth).padStart(2, "0")}`;
  while (weekdayOfKey(date) === 0 || weekdayOfKey(date) === 6 || holidaySet.has(date)) {
    date = addDaysToKey(date, 1);
  }
  return date;
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

    // 매달 반복(monthly)과 분기 반복(quarterly)이 같은 달에 겹치면(3·6·9·12월)
    // 분기 일정을 우선한다. 이 달에 적용되는 일정들의 발생일을 먼저 전부
    // 계산해 날짜별 "승자"를 정한다.
    const applicable = events.filter((e) => CYCLE_MONTHS[e.cycle].includes(month));
    const occurrenceDateByEventId = new Map<number, string>();
    const winnerByDate = new Map<string, RecurringEventRow>();
    for (const event of applicable) {
      const occurrenceDate = computeOccurrenceDate(monthKey, event.day_of_month, holidaySet);
      occurrenceDateByEventId.set(event.id, occurrenceDate);
      const current = winnerByDate.get(occurrenceDate);
      if (!current || (current.cycle === "monthly" && event.cycle !== "monthly")) {
        winnerByDate.set(occurrenceDate, event);
      }
    }

    for (const event of applicable) {
      const occurrenceDate = occurrenceDateByEventId.get(event.id)!;
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
