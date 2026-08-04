import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { query, type ReservationRow } from "@/lib/db";
import { ReservationTable } from "./reservation-table";

export default async function AdminReservationsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const result = await query<ReservationRow>(
    `SELECT * FROM reservations ORDER BY created_at DESC`,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Reservations</p>
      <h1 className="font-display text-2xl mb-1">사전예약 현황</h1>
      <p className="text-sm text-ink/50 mb-6">홈페이지로 들어온 사전예약 신청을 확인하세요.</p>
      <ReservationTable initialReservations={result.rows} />
    </div>
  );
}
