import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { peekLastAction, undoLastAction } from "@/lib/undo";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const pending = await peekLastAction();
  return NextResponse.json({ pending });
}

export async function POST() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const result = await undoLastAction();
  if (!result) {
    return NextResponse.json({ error: "취소할 작업이 없어요." }, { status: 404 });
  }
  return NextResponse.json(result);
}
