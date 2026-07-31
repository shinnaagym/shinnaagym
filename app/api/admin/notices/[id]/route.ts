import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteNotice, updateNotice } from "@/lib/notices";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { NoticeRow } from "@/lib/db";

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
  const body = (await req.json().catch(() => null)) as
    | { title?: unknown; content?: unknown }
    | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }
  const before = (await query<NoticeRow>(`SELECT * FROM notices WHERE id = $1`, [idNum])).rows[0];
  const notice = await updateNotice(idNum, title, content);
  if (!notice) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  if (before) {
    await recordUndo(`"${before.title}" 공지 수정`, [
      { op: "update", table: "notices", id: idNum, data: { title: before.title, content: before.content } },
    ]);
  }
  return NextResponse.json({ notice });
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
  const before = (await query<NoticeRow>(`SELECT * FROM notices WHERE id = $1`, [idNum])).rows[0];
  const deleted = await deleteNotice(idNum);
  if (!deleted) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  if (before) {
    await recordUndo(`"${before.title}" 공지 삭제`, [{ op: "insert", table: "notices", data: before }]);
  }
  return NextResponse.json({ ok: true });
}
