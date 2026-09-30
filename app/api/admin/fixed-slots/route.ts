import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addFixedSlotWithBackfill, listFixedSlots } from "@/lib/schedule";
import type { FixedSlotType } from "@/lib/db";
import { recordUndo, type UndoOp } from "@/lib/undo";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const slots = await listFixedSlots();
  return NextResponse.json({ slots });
}

function isValidHour(h: unknown): h is number {
  return typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23;
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { memberId?: unknown; weekday?: unknown; hour?: unknown; hours?: unknown; slotType?: unknown }
    | null;
  const memberId = Number(body?.memberId);
  const weekday = Number(body?.weekday);
  const slotType: FixedSlotType = body?.slotType === "flexible" ? "flexible" : "fixed";
  // "다른 가능한 시간"은 한 번에 여러 시간을 동시에 후보로 등록할 수 있어 hours
  // 배열을 받고, 기존 "고정" 흐름과의 호환을 위해 단일 hour도 계속 받는다.
  const hours: unknown[] = Array.isArray(body?.hours) ? body.hours : [body?.hour];

  if (!Number.isInteger(memberId) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const validHours = hours.filter(isValidHour);
  if (validHours.length === 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const results = [];
    for (const hour of validHours) {
      results.push(await addFixedSlotWithBackfill(memberId, weekday, hour, slotType));
    }
    const ops: UndoOp[] = results.flatMap((result): UndoOp[] => [
      ...result.createdSessionIds.map((sid): UndoOp => ({ op: "delete", table: "class_sessions", id: sid })),
      { op: "delete", table: "fixed_slots", id: result.slot.id },
    ]);
    await recordUndo(
      slotType === "fixed" ? "고정 시간대 추가" : "다른 가능한 시간 추가",
      ops,
    );
    return NextResponse.json(
      { slots: results.map((r) => r.slot), created: 0, skippedDates: [] },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "고정 시간대 추가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
