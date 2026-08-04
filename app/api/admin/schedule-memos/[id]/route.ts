import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteScheduleMemo, updateScheduleMemo } from "@/lib/schedule-memos";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { ScheduleMemoRow } from "@/lib/db";

export async function PATCH(
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
  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "메모 내용을 입력해주세요." }, { status: 400 });
  }
  const before = (
    await query<ScheduleMemoRow>(`SELECT * FROM schedule_memos WHERE id = $1`, [idNum])
  ).rows[0];
  const updated = await updateScheduleMemo(idNum, content);
  if (!updated) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  if (before) {
    await recordUndo("메모 수정", [
      { op: "update", table: "schedule_memos", id: idNum, data: { content: before.content } },
    ]);
  }
  return NextResponse.json({ memo: updated });
}

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
  const before = (
    await query<ScheduleMemoRow>(`SELECT * FROM schedule_memos WHERE id = $1`, [idNum])
  ).rows[0];
  const deleted = await deleteScheduleMemo(idNum);
  if (!deleted) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  if (before) {
    await recordUndo("메모 삭제", [{ op: "insert", table: "schedule_memos", data: before }]);
  }
  return NextResponse.json({ ok: true });
}
