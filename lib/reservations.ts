import { query } from "./db";
import { koreaTodayKey } from "./date";

export interface TakenSlot {
  date: string;
  hour: number;
}

/**
 * 사전예약 랜딩페이지 달력에서 막을 시간대를 구한다. 사전예약(reservations)
 * 뿐 아니라 스케줄표에 직접 등록된 PT수업·상담(class_sessions, entry_type
 * 'session'/'consultation')도 함께 반영해, 관리자가 스케줄표에서 직접
 * 등록했거나 사전예약을 다른 날짜/시간으로 옮긴 경우에도 그 자리가 바로
 * 막히게 한다(사전예약은 코치를 특정하지 않는 하나의 공용 상담 슬롯이라,
 * 어느 코치의 스케줄이든 해당 시간에 PT수업·상담이 있으면 막는다).
 */
export async function getTakenSlots(): Promise<TakenSlot[]> {
  const today = koreaTodayKey();
  const result = await query<{ date: string; hour: number }>(
    `SELECT reservation_date AS date, reservation_hour AS hour
       FROM reservations
      WHERE reservation_date >= $1
     UNION
     SELECT session_date AS date, session_hour AS hour
       FROM class_sessions
      WHERE session_date >= $1
        AND entry_type IN ('session', 'consultation')
        AND status NOT IN ('cancelled', 'no_show')`,
    [today],
  );
  return result.rows.map((row) => ({ date: row.date, hour: row.hour }));
}
