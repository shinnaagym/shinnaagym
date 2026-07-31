import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  createRecurringEvent,
  listRecurringEvents,
  type RecurringEventInput,
} from "@/lib/recurring-events";
import { recordUndo } from "@/lib/undo";
import type { RecurringEventCycle } from "@/lib/db";

const VALID_CYCLES: RecurringEventCycle[] = ["monthly", "quarterly"];

function parseInput(body: unknown): RecurringEventInput | null {
  const b = body as
    | {
        name?: unknown;
        cycle?: unknown;
        dayOfMonth?: unknown;
        startHour?: unknown;
        endHour?: unknown;
      }
    | null;
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  const cycle = typeof b?.cycle === "string" && VALID_CYCLES.includes(b.cycle as RecurringEventCycle)
    ? (b.cycle as RecurringEventCycle)
    : null;
  const dayOfMonth = typeof b?.dayOfMonth === "number" ? b.dayOfMonth : NaN;
  const startHour = typeof b?.startHour === "number" ? b.startHour : NaN;
  const endHour = typeof b?.endHour === "number" ? b.endHour : NaN;

  if (
    !name ||
    !cycle ||
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 28 ||
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    endHour > 24 ||
    startHour >= endHour
  ) {
    return null;
  }
  return { name, cycle, dayOfMonth, startHour, endHour };
}

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const events = await listRecurringEvents();
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const input = parseInput(await req.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "입력값을 확인해주세요." }, { status: 400 });
  }
  const event = await createRecurringEvent(input);
  await recordUndo(`${input.name} 정기 일정 등록`, [
    { op: "delete", table: "recurring_events", id: event.id },
  ]);
  return NextResponse.json({ event }, { status: 201 });
}
