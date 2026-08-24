import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import {
  LEAVE_TYPE_OPTIONS,
  SHORTENED_LEAVE_DIRECTION_OPTIONS,
  SHORTENED_LEAVE_MAX_HOURS,
} from "@/lib/constants";
import { addCoachLeave, removeCoachLeave } from "@/lib/schedule";

const VALID_LEAVE_TYPES = new Set(LEAVE_TYPE_OPTIONS.map((o) => o.value));
const VALID_DIRECTIONS = new Set(SHORTENED_LEAVE_DIRECTION_OPTIONS.map((o) => o.value));

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { coachId?: unknown; date?: unknown; leaveType?: unknown; direction?: unknown; hours?: unknown }
    | null;
  const coachId = typeof body?.coachId === "number" && Number.isInteger(body.coachId) ? body.coachId : null;
  const date = typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : null;
  const leaveType =
    typeof body?.leaveType === "string" && VALID_LEAVE_TYPES.has(body.leaveType as never) ? body.leaveType : null;
  if (!coachId || !date || !leaveType) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let direction: string | null = null;
  let hours: number | null = null;
  if (leaveType === "shortened") {
    direction =
      typeof body?.direction === "string" && VALID_DIRECTIONS.has(body.direction as never)
        ? body.direction
        : null;
    hours =
      typeof body?.hours === "number" && Number.isInteger(body.hours) && body.hours >= 1 && body.hours <= SHORTENED_LEAVE_MAX_HOURS
        ? body.hours
        : null;
    if (!direction || !hours) {
      return NextResponse.json(
        { error: "단축근무는 출근 지연/조기 퇴근 여부와 시간(최대 2시간)을 선택해야 해요." },
        { status: 400 },
      );
    }
  }

  const entry = await addCoachLeave(coachId, date, leaveType, direction, hours);
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
