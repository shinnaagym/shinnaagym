import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createSession, listSessionsInRange } from "@/lib/schedule";
import { isValidDateKey } from "@/lib/date";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !isValidDateKey(from) || !isValidDateKey(to)) {
    return NextResponse.json({ error: "잘못된 날짜 범위입니다." }, { status: 400 });
  }
  const sessions = await listSessionsInRange(from, to);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        memberId?: unknown;
        coachId?: unknown;
        date?: unknown;
        hour?: unknown;
        memo?: unknown;
      }
    | null;

  const memberId = Number(body?.memberId);
  const coachId = Number(body?.coachId);
  const date = typeof body?.date === "string" ? body.date : "";
  const hour = Number(body?.hour);
  const memo = typeof body?.memo === "string" ? body.memo : "";

  if (!Number.isInteger(memberId) || !Number.isInteger(coachId) || !isValidDateKey(date) || !Number.isInteger(hour)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const session = await createSession({ memberId, coachId, date, hour, memo });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "이미 예약된 시간이에요." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "예약 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
