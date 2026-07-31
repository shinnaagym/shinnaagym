import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addFixedSlotWithBackfill, listFixedSlots } from "@/lib/schedule";
import { recordUndo, type UndoOp } from "@/lib/undo";

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
  try {
    const result = await addFixedSlotWithBackfill(memberId, weekday, hour);
    const ops: UndoOp[] = [
      ...result.createdSessionIds.map((sid): UndoOp => ({ op: "delete", table: "class_sessions", id: sid })),
      { op: "delete", table: "fixed_slots", id: result.slot.id },
    ];
    await recordUndo("고정 시간대 추가", ops);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "고정 시간대 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
