import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { removeFixedSlot } from "@/lib/schedule";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { FixedSlotRow } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const before = (await query<FixedSlotRow>(`SELECT * FROM fixed_slots WHERE id = $1`, [idNum])).rows[0];
  await removeFixedSlot(idNum);
  if (before) {
    await recordUndo("고정 시간대 삭제", [{ op: "insert", table: "fixed_slots", data: before }]);
  }
  return NextResponse.json({ ok: true });
}
