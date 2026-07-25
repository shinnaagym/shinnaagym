import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { query, type ReservationRow } from "@/lib/db";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const result = await query<ReservationRow>(
    `SELECT * FROM reservations ORDER BY reservation_date ASC, reservation_hour ASC`,
  );
  return NextResponse.json({ reservations: result.rows });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await query(`DELETE FROM reservations WHERE id = $1`, [idNum]);
  return NextResponse.json({ ok: true });
}
