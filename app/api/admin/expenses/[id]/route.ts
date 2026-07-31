import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteExpense } from "@/lib/expenses";
import { query, type ExpenseRow } from "@/lib/db";
import { recordUndo } from "@/lib/undo";

export async function DELETE(
  _req: NextRequest,
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
  const before = (await query<ExpenseRow>(`SELECT * FROM expenses WHERE id = $1`, [idNum]))
    .rows[0];
  const deleted = await deleteExpense(idNum);
  if (!deleted) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  if (before) {
    await recordUndo(`"${before.item}" 지출 삭제`, [
      { op: "insert", table: "expenses", data: before },
    ]);
  }
  return NextResponse.json({ ok: true });
}
