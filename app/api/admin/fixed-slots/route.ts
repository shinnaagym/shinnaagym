import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addFixedSlot, listFixedSlots } from "@/lib/schedule";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const slots = await listFixedSlots();
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { memberId?: unknown; weekday?: unknown; hour?: unknown }
    | null;
  const memberId = Number(body?.memberId);
  const weekday = Number(body?.weekday);
  const hour = Number(body?.hour);
  if (
    !Number.isInteger(memberId) ||
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const slot = await addFixedSlot(memberId, weekday, hour);
  return NextResponse.json({ slot }, { status: 201 });
}
