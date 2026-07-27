import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { query, type ReservationRow } from "@/lib/db";
import { ReservationTable } from "./reservation-table";

export default async function AdminReservationsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const result = await query<ReservationRow>(
    `SELECT * FROM reservations ORDER BY reservation_date ASC, reservation_hour ASC`,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <ReservationTable initialReservations={result.rows} />
    </div>
  );
}
