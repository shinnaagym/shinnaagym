import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addHoliday, listHolidays, removeHoliday } from "@/lib/schedule";
import { isValidDateKey } from "@/lib/date";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const holidays = await listHolidays();
  return NextResponse.json({ holidays });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { date?: unknown; name?: unknown }
    | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!isValidDateKey(date) || !name) {
    return NextResponse.json({ error: "날짜와 이름을 올바르게 입력해주세요." }, { status: 400 });
  }
  await addHoliday(date, name);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidDateKey(date)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await removeHoliday(date);
  return NextResponse.json({ ok: true });
}
