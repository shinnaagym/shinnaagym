import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { moveFixedSlot, removeFixedSlot } from "@/lib/schedule";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { FixedSlotRow } from "@/lib/db";

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
  const body = (await req.json().catch(() => null)) as { weekday?: unknown; hour?: unknown } | null;
  const weekday = Number(body?.weekday);
  const hour = Number(body?.hour);
  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const before = (await query<FixedSlotRow>(`SELECT * FROM fixed_slots WHERE id = $1`, [idNum])).rows[0];
  if (!before) {
    return NextResponse.json({ error: "고정 시간대를 찾을 수 없습니다." }, { status: 404 });
  }
  try {
    const slot = await moveFixedSlot(idNum, weekday, hour);
    if (before.weekday !== slot.weekday || before.hour !== slot.hour) {
      await recordUndo("고정 시간대 이동", [
        {
          op: "update",
          table: "fixed_slots",
          id: idNum,
          data: { weekday: before.weekday, hour: before.hour },
        },
      ]);
    }
    return NextResponse.json({ slot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "이동 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
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
  const before = (await query<FixedSlotRow>(`SELECT * FROM fixed_slots WHERE id = $1`, [idNum])).rows[0];
  await removeFixedSlot(idNum);
  if (before) {
    await recordUndo("고정 시간대 삭제", [{ op: "insert", table: "fixed_slots", data: before }]);
  }
  return NextResponse.json({ ok: true });
}
