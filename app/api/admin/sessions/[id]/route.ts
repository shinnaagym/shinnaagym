import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteSession, updateSession } from "@/lib/schedule";
import { isValidDateKey } from "@/lib/date";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { ClassSessionRow, PtType, SessionStatus } from "@/lib/db";

const VALID_STATUSES: SessionStatus[] = ["reserved", "completed", "no_show", "cancelled"];
const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        status?: unknown;
        memo?: unknown;
        coachId?: unknown;
        ptType?: unknown;
        date?: unknown;
        hour?: unknown;
      }
    | null;

  const status =
    typeof body?.status === "string" && VALID_STATUSES.includes(body.status as SessionStatus)
      ? (body.status as SessionStatus)
      : undefined;
  const memo = typeof body?.memo === "string" ? body.memo : undefined;
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId)
      ? body.coachId
      : undefined;
  const ptType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : undefined;
  const sessionDate =
    typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : undefined;
  const sessionHour =
    typeof body?.hour === "number" && Number.isInteger(body.hour) ? body.hour : undefined;

  const before = (
    await query<ClassSessionRow>(`SELECT * FROM class_sessions WHERE id = $1`, [idNum])
  ).rows[0];
  if (!before) {
    return NextResponse.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    await updateSession(idNum, { status, memo, coachId, ptType, sessionDate, sessionHour });

    const prevValues: Record<string, unknown> = {};
    if (status !== undefined) prevValues.status = before.status;
    if (memo !== undefined) prevValues.memo = before.memo;
    if (coachId !== undefined) prevValues.coach_id = before.coach_id;
    if (ptType !== undefined) prevValues.pt_type = before.pt_type;
    if (sessionDate !== undefined) prevValues.session_date = before.session_date;
    if (sessionHour !== undefined) prevValues.session_hour = before.session_hour;
    await recordUndo(`${before.session_date} ${before.session_hour}시 일정 수정`, [
      { op: "update", table: "class_sessions", id: idNum, data: prevValues },
    ]);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "이미 일정이 있는 시간이에요." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "이동 중 오류가 발생했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const before = (
    await query<ClassSessionRow>(`SELECT * FROM class_sessions WHERE id = $1`, [idNum])
  ).rows[0];
  await deleteSession(idNum);
  if (before) {
    await recordUndo(`${before.session_date} ${before.session_hour}시 일정 삭제`, [
      { op: "insert", table: "class_sessions", data: before },
    ]);
  }
  return NextResponse.json({ ok: true });
}
