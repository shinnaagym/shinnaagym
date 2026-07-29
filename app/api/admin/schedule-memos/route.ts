import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createScheduleMemo, listScheduleMemos } from "@/lib/schedule-memos";
import { recordUndo } from "@/lib/undo";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const memos = await listScheduleMemos();
  return NextResponse.json({ memos });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "메모 내용을 입력해주세요." }, { status: 400 });
  }
  const memo = await createScheduleMemo(content);
  await recordUndo("메모 추가", [{ op: "delete", table: "schedule_memos", id: memo.id }]);
  return NextResponse.json({ memo }, { status: 201 });
}
