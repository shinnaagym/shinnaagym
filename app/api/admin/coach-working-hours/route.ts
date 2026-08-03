import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getCoachWorkingHours, setCoachWorkingHours } from "@/lib/schedule";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const hours = await getCoachWorkingHours();
  return NextResponse.json({ hours });
}

function toHour(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : null;
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const coachId = typeof body?.coachId === "number" ? body.coachId : NaN;
  if (!Number.isInteger(coachId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body?.clear === true) {
    await setCoachWorkingHours(coachId, null);
    const hours = await getCoachWorkingHours();
    return NextResponse.json({ hours });
  }

  const weekdayStartsRaw = Array.isArray(body?.weekdayStarts) ? body.weekdayStarts : null;
  const weekdayEndsRaw = Array.isArray(body?.weekdayEnds) ? body.weekdayEnds : null;
  const saturdayStart = toHour(body?.saturdayStart);
  const saturdayEnd = toHour(body?.saturdayEnd);
  if (
    !weekdayStartsRaw ||
    !weekdayEndsRaw ||
    weekdayStartsRaw.length !== 5 ||
    weekdayEndsRaw.length !== 5 ||
    saturdayStart === null ||
    saturdayEnd === null
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const weekdayStarts = weekdayStartsRaw.map(toHour);
  const weekdayEnds = weekdayEndsRaw.map(toHour);
  if (weekdayStarts.some((h) => h === null) || weekdayEnds.some((h) => h === null)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (
    weekdayStarts.some((h, i) => (h as number) >= (weekdayEnds[i] as number)) ||
    saturdayStart >= saturdayEnd
  ) {
    return NextResponse.json(
      { error: "종료 시각은 시작 시각보다 늦어야 해요." },
      { status: 400 },
    );
  }

  await setCoachWorkingHours(coachId, {
    weekdayStarts: weekdayStarts as number[],
    weekdayEnds: weekdayEnds as number[],
    saturdayStart,
    saturdayEnd,
  });
  const hours = await getCoachWorkingHours();
  return NextResponse.json({ hours });
}
