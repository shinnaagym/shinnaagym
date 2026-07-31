import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteRecurringEvent, updateRecurringEvent } from "@/lib/recurring-events";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { RecurringEventCycle, RecurringEventRow } from "@/lib/db";

const VALID_CYCLES: RecurringEventCycle[] = ["monthly", "quarterly"];

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
  const before = (
    await query<RecurringEventRow>(`SELECT * FROM recurring_events WHERE id = $1`, [idNum])
  ).rows[0];
  if (!before) {
    return NextResponse.json({ error: "정기 일정을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        cycle?: unknown;
        dayOfMonth?: unknown;
        startHour?: unknown;
        endHour?: unknown;
        enabled?: unknown;
      }
    | null;

  const patch: Parameters<typeof updateRecurringEvent>[1] = {};
  if (body?.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }
    patch.name = body.name.trim();
  }
  if (body?.cycle !== undefined) {
    if (typeof body.cycle !== "string" || !VALID_CYCLES.includes(body.cycle as RecurringEventCycle)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    patch.cycle = body.cycle as RecurringEventCycle;
  }
  if (body?.dayOfMonth !== undefined) {
    if (typeof body.dayOfMonth !== "number" || !Number.isInteger(body.dayOfMonth) || body.dayOfMonth < 1 || body.dayOfMonth > 28) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    patch.dayOfMonth = body.dayOfMonth;
  }
  const nextStartHour =
    typeof body?.startHour === "number" ? body.startHour : before.start_hour;
  const nextEndHour = typeof body?.endHour === "number" ? body.endHour : before.end_hour;
  if (body?.startHour !== undefined || body?.endHour !== undefined) {
    if (
      !Number.isInteger(nextStartHour) ||
      !Number.isInteger(nextEndHour) ||
      nextStartHour < 0 ||
      nextEndHour > 24 ||
      nextStartHour >= nextEndHour
    ) {
      return NextResponse.json({ error: "잘못된 시간입니다." }, { status: 400 });
    }
    if (body.startHour !== undefined) patch.startHour = nextStartHour;
    if (body.endHour !== undefined) patch.endHour = nextEndHour;
  }
  if (body?.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    patch.enabled = body.enabled;
  }

  await updateRecurringEvent(idNum, patch);
  await recordUndo(`${before.name} 정기 일정 수정`, [
    {
      op: "update",
      table: "recurring_events",
      id: idNum,
      data: {
        name: before.name,
        cycle: before.cycle,
        day_of_month: before.day_of_month,
        start_hour: before.start_hour,
        end_hour: before.end_hour,
        enabled: before.enabled,
      },
    },
  ]);
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
    await query<RecurringEventRow>(`SELECT * FROM recurring_events WHERE id = $1`, [idNum])
  ).rows[0];
  await deleteRecurringEvent(idNum);
  if (before) {
    await recordUndo(`${before.name} 정기 일정 삭제`, [
      { op: "insert", table: "recurring_events", data: before },
    ]);
  }
  return NextResponse.json({ ok: true });
}
