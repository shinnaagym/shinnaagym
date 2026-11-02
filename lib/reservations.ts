import { query } from "./db";
import { koreaTodayKey } from "./date";

export interface TakenSlot {
  date: string;
  hour: number;
}

/**
 * 사전예약 랜딩페이지 달력에서 막을 시간대를 구한다. 사전예약(reservations)은
 * 코치를 특정하지 않는 하나의 공용 상담 슬롯이라, 이미 접수된 사전예약이
 * 있으면 그대로 막는다. 스케줄표에 직접 등록된 PT수업·상담(class_sessions,
 * entry_type 'session'/'consultation')은, 재직 중인 코치 중 그 시간에 비어
 * 있는 코치가 단 한 명도 없을 때만 막는다 — 새 사전예약은 비어있는 아무
 * 코치의 칸에나 자동으로 잡히므로, 일부 코치만 그 시간에 수업이 있다고
 * 선점할 필요가 없다.
 */
export async function getTakenSlots(): Promise<TakenSlot[]> {
  const today = koreaTodayKey();
  const result = await query<{ date: string; hour: number }>(
    `SELECT reservation_date AS date, reservation_hour AS hour
       FROM reservations
      WHERE reservation_date >= $1
     UNION
     SELECT session_date AS date, session_hour AS hour
       FROM class_sessions s
      WHERE session_date >= $1
        AND entry_type IN ('session', 'consultation')
        AND status NOT IN ('cancelled', 'no_show')
        AND s.coach_id IN (SELECT id FROM coaches WHERE active = true)
      GROUP BY session_date, session_hour
     HAVING COUNT(DISTINCT s.coach_id) >= (SELECT COUNT(*) FROM coaches WHERE active = true)`,
    [today],
  );
  return result.rows.map((row) => ({ date: row.date, hour: row.hour }));
}

/** 접수 직전에 한 번 더 확인하는 "이 시간, 비어있는 재직 코치가 하나도
    없는가" 체크 — getTakenSlots와 같은 기준이다(목록 조회 이후 다른 예약이
    먼저 들어왔을 수 있어, POST 시점에 다시 확인한다). */
export async function isSlotFullyBooked(date: string, hour: number): Promise<boolean> {
  const result = await query<{ fully_booked: boolean }>(
    `SELECT NOT EXISTS (
       SELECT 1 FROM coaches c
        WHERE c.active = true
          AND NOT EXISTS (
            SELECT 1 FROM class_sessions s
             WHERE s.coach_id = c.id
               AND s.session_date = $1
               AND s.session_hour = $2
               AND s.entry_type IN ('session', 'consultation')
               AND s.status NOT IN ('cancelled', 'no_show')
          )
     ) as fully_booked`,
    [date, hour],
  );
  return result.rows[0]?.fully_booked ?? false;
}
