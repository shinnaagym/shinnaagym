import { query } from "./db";
import { addDaysToKey, koreaTodayKey, weekdayIndexMonFirst } from "./date";
import { BOOKING_START_DATE, BOOKING_WINDOW_DAYS, businessHours } from "./constants";
import { getCoachWorkingHours, isCoachWithinWeekdayHours, listCoaches, pickAvailableCoachId } from "./schedule";

export interface TakenSlot {
  date: string;
  hour: number;
}

async function listHolidayDateSetInRange(fromKey: string, toKey: string): Promise<Set<string>> {
  const result = await query<{ holiday_date: string }>(
    `SELECT holiday_date FROM holidays WHERE holiday_date >= $1 AND holiday_date <= $2`,
    [fromKey, toKey],
  );
  return new Set(result.rows.map((r) => r.holiday_date));
}

/**
 * 사전예약 랜딩페이지 달력에서 막을 시간대를 구한다. 사전예약(reservations)은
 * 코치를 특정하지 않는 하나의 공용 상담 슬롯이라, 이미 접수된 사전예약이
 * 있으면 그대로 막는다. 스케줄표에 직접 등록된 PT수업·상담(class_sessions,
 * entry_type 'session'/'consultation')은, 재직 중인 코치 중 그 시간에
 * 비어있고 근무시간(오전조/오후조 등 코치별 설정) 안인 코치가 단 한 명도
 * 없을 때만 막는다 — 새 사전예약은 그런 코치의 칸에나 자동으로 잡히므로,
 * 일부 코치만 그 시간에 수업이 있거나 근무시간이 아니라고 선점할 필요가
 * 없다. 예약 가능 날짜 범위(오늘~예약 윈도 끝) 전체를 훑어야 해서, 코치
 * 수·날짜 수가 크지 않은 이 서비스 규모에서는 DB 한 번의 세션 조회 뒤
 * 애플리케이션 코드에서 날짜×시간×코치를 순회하는 편이, UNION/HAVING만으로
 * "그 시간에 아무 세션도 없지만 전원 근무시간이 아닌" 경우까지 SQL 한 번에
 * 표현하는 것보다 더 읽기 쉽다.
 */
export async function getTakenSlots(): Promise<TakenSlot[]> {
  const today = koreaTodayKey();
  const minDate = today > BOOKING_START_DATE ? today : BOOKING_START_DATE;
  const windowEnd = addDaysToKey(BOOKING_START_DATE, BOOKING_WINDOW_DAYS);

  const [reservationsResult, sessionsResult, coaches, workingHours, holidaySet] = await Promise.all([
    query<{ date: string; hour: number }>(
      `SELECT reservation_date AS date, reservation_hour AS hour FROM reservations WHERE reservation_date >= $1`,
      [today],
    ),
    query<{ coach_id: number; date: string; hour: number }>(
      `SELECT coach_id, session_date AS date, session_hour AS hour
         FROM class_sessions
        WHERE session_date >= $1 AND session_date <= $2
          AND entry_type IN ('session', 'consultation')
          AND status NOT IN ('cancelled', 'no_show')`,
      [minDate, windowEnd],
    ),
    listCoaches(true),
    getCoachWorkingHours(),
    listHolidayDateSetInRange(minDate, windowEnd),
  ]);

  const busySet = new Set(sessionsResult.rows.map((r) => `${r.coach_id}:${r.date}:${r.hour}`));
  const taken: TakenSlot[] = reservationsResult.rows.map((r) => ({ date: r.date, hour: r.hour }));

  for (let dateKey = minDate; dateKey <= windowEnd; dateKey = addDaysToKey(dateKey, 1)) {
    const hours = businessHours(dateKey, holidaySet.has(dateKey));
    if (hours.length === 0) continue; // 일요일은 영업하지 않는다.
    const weekdayIdx = weekdayIndexMonFirst(dateKey);
    for (const hour of hours) {
      const anyCoachAvailable = coaches.some(
        (c) =>
          !busySet.has(`${c.id}:${dateKey}:${hour}`) &&
          isCoachWithinWeekdayHours(c.id, weekdayIdx, hour, workingHours),
      );
      if (!anyCoachAvailable) taken.push({ date: dateKey, hour });
    }
  }
  return taken;
}

/** 접수 직전에 한 번 더 확인하는 "이 시간, 비어있고 근무시간인 재직 코치가
    하나도 없는가" 체크 — getTakenSlots·linkPreReservationToSchedule과 같은
    기준이다(목록 조회 이후 다른 예약이 먼저 들어왔을 수 있어, POST 시점에
    다시 확인한다). */
export async function isSlotFullyBooked(date: string, hour: number): Promise<boolean> {
  return (await pickAvailableCoachId(date, hour)) === null;
}
