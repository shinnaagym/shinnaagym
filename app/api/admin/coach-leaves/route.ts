import { NextRequest, NextResponse } from "next/server";
import { checkLedgerPassword, isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import {
  LEAVE_TYPE_OPTIONS,
  SHORTENED_LEAVE_DIRECTION_OPTIONS,
  SHORTENED_LEAVE_MAX_HOURS,
} from "@/lib/constants";
import { addCoachLeave, LeaveValidationError, removeCoachLeave } from "@/lib/schedule";

const VALID_LEAVE_TYPES = new Set(LEAVE_TYPE_OPTIONS.map((o) => o.value));
const VALID_DIRECTIONS = new Set(SHORTENED_LEAVE_DIRECTION_OPTIONS.map((o) => o.value));

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        coachId?: unknown;
        date?: unknown;
        leaveType?: unknown;
        direction?: unknown;
        hours?: unknown;
        overridePassword?: unknown;
      }
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

  // 신청시기가 지났거나 한도를 초과하면 원칙적으로 막되, 대표 승인 비밀번호가
  // 함께 오면 검증을 건너뛰고 등록을 허용한다(유도리 있게 예외 처리).
  const overridePassword = typeof body?.overridePassword === "string" ? body.overridePassword : "";
  const hasValidOverride = overridePassword.length > 0 && checkLedgerPassword(overridePassword);

  try {
    const entry = await addCoachLeave(coachId, date, leaveType, direction, hours, hasValidOverride);
    return NextResponse.json({ entry });
  } catch (err) {
    if (err instanceof LeaveValidationError) {
      if (overridePassword && !hasValidOverride) {
        return NextResponse.json(
          { error: "대표 승인 비밀번호가 올바르지 않아요.", needsOverride: true },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: err.message, needsOverride: true }, { status: 400 });
    }
    throw err;
  }
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
