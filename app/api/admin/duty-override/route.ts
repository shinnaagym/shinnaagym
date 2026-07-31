import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import { getDutyOverridesForDates, setDutyOverride } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const dateKeys = (searchParams.get("dates") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(isValidDateKey);
  const overrides = await getDutyOverridesForDates(dateKeys);
  return NextResponse.json({ overrides });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { date?: unknown; coachId?: unknown; clear?: unknown }
    | null;
  const date = typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : null;
  if (!date) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body?.clear === true) {
    await setDutyOverride(date, undefined);
  } else {
    const coachId =
      body?.coachId === null
        ? null
        : typeof body?.coachId === "number" && Number.isInteger(body.coachId)
          ? body.coachId
          : undefined;
    if (coachId === undefined) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await setDutyOverride(date, coachId);
  }
  return NextResponse.json({ ok: true });
}
