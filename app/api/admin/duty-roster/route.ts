import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getDutyRoster, setDutyAssignment } from "@/lib/schedule";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const roster = await getDutyRoster();
  return NextResponse.json({ roster });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { weekday?: unknown; coachId?: unknown }
    | null;
  const weekday = typeof body?.weekday === "number" ? body.weekday : NaN;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const coachId =
    body?.coachId === null
      ? null
      : typeof body?.coachId === "number" && Number.isInteger(body.coachId)
        ? body.coachId
        : undefined;
  if (coachId === undefined) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await setDutyAssignment(weekday, coachId);
  const roster = await getDutyRoster();
  return NextResponse.json({ roster });
}
