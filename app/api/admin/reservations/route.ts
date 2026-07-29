import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { query, type ClassSessionRow, type ReservationRow } from "@/lib/db";
import { updateSession } from "@/lib/schedule";
import { recordUndo, type UndoOp } from "@/lib/undo";

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

  const existing = await query<ReservationRow>(
    `SELECT * FROM reservations WHERE id = $1`,
    [idNum],
  );
  const reservation = existing.rows[0];
  const linkedSessionId = reservation?.class_session_id;
  let linkedSessionBefore: ClassSessionRow | undefined;
  if (linkedSessionId) {
    linkedSessionBefore = (
      await query<ClassSessionRow>(`SELECT * FROM class_sessions WHERE id = $1`, [linkedSessionId])
    ).rows[0];
    await updateSession(linkedSessionId, { status: "cancelled" });
  }

  await query(`DELETE FROM reservations WHERE id = $1`, [idNum]);

  if (reservation) {
    const ops: UndoOp[] = [{ op: "insert", table: "reservations", data: reservation }];
    if (linkedSessionBefore) {
      ops.unshift({
        op: "update",
        table: "class_sessions",
        id: linkedSessionBefore.id,
        data: { status: linkedSessionBefore.status },
      });
    }
    await recordUndo(`${reservation.name} 사전예약 삭제`, ops);
  }

  return NextResponse.json({ ok: true });
}
