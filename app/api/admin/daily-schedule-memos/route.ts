import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import { setDailyScheduleMemo } from "@/lib/daily-schedule-memos";

/** 날짜 칸 바로 아래 메모 저장 — 빈 문자열을 보내면 그 날짜의 메모를 지운다. */
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { date?: unknown; content?: unknown } | null;
  const date = typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : null;
  const content = typeof body?.content === "string" ? body.content : null;
  if (!date || content === null) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await setDailyScheduleMemo(date, content);
  return NextResponse.json({ ok: true });
}
