import { query } from "./db";
import { koreaTodayKey } from "./date";

export interface TakenSlot {
  date: string;
  hour: number;
}

export async function getTakenSlots(): Promise<TakenSlot[]> {
  const today = koreaTodayKey();
  const result = await query<{ reservation_date: string; reservation_hour: number }>(
    `SELECT reservation_date, reservation_hour FROM reservations WHERE reservation_date >= $1`,
    [today],
  );
  return result.rows.map((row) => ({ date: row.reservation_date, hour: row.reservation_hour }));
}
