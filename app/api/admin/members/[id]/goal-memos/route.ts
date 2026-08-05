import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createGoalMemo } from "@/lib/goal-memos";
import { recordUndo } from "@/lib/undo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "메모 내용을 입력해주세요." }, { status: 400 });
  }
  const memo = await createGoalMemo(memberId, content);
  await recordUndo("목표 메모 추가", [{ op: "delete", table: "goal_memos", id: memo.id }]);
  return NextResponse.json({ memo }, { status: 201 });
}
