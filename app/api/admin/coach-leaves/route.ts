import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import { LEAVE_TYPE_OPTIONS } from "@/lib/constants";
import { addCoachLeave, removeCoachLeave } from "@/lib/schedule";

const VALID_LEAVE_TYPES = new Set(LEAVE_TYPE_OPTIONS.map((o) => o.value));

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { coachId?: unknown; date?: unknown; leaveType?: unknown }
    | null;
  const coachId = typeof body?.coachId === "number" && Number.isInteger(body.coachId) ? body.coachId : null;
  const date = typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : null;
  const leaveType = typeof body?.leaveType === "string" && VALID_LEAVE_TYPES.has(body.leaveType as never) ? body.leaveType : null;
  if (!coachId || !date || !leaveType) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const entry = await addCoachLeave(coachId, date, leaveType);
  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await removeCoachLeave(id);
  return NextResponse.json({ ok: true });
}
