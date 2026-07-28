import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createAssessment, listAssessmentsByMember } from "@/lib/assessments";
import { ASSESSMENT_REGIONS, MMT_STRENGTH_OPTIONS, NRS_PAIN_OPTIONS } from "@/lib/assessment-movements";
import type { AssessmentMovements, PainTriggerEntry } from "@/lib/db";

const VALID_MOVEMENT_IDS = new Set(
  ASSESSMENT_REGIONS.flatMap((region) => region.movements.map((m) => m.id)),
);
const VALID_STRENGTH_VALUES = new Set<string>([...MMT_STRENGTH_OPTIONS, ""]);
const VALID_PAIN_SCALE_VALUES = new Set<string>([...NRS_PAIN_OPTIONS, ""]);

function parseMovements(raw: unknown): AssessmentMovements {
  const movements: AssessmentMovements = {};
  if (!raw || typeof raw !== "object") return movements;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_MOVEMENT_IDS.has(key) || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const romPassive = typeof entry.romPassive === "string" ? entry.romPassive.trim() : "";
    const romActive = typeof entry.romActive === "string" ? entry.romActive.trim() : "";
    const strength =
      typeof entry.strength === "string" && VALID_STRENGTH_VALUES.has(entry.strength)
        ? entry.strength
        : "";
    const painScale =
      typeof entry.painScale === "string" && VALID_PAIN_SCALE_VALUES.has(entry.painScale)
        ? entry.painScale
        : "";
    const compensation = typeof entry.compensation === "string" ? entry.compensation.trim() : "";
    if (!romPassive && !romActive && !strength && !painScale && !compensation) continue;
    movements[key] = { romPassive, romActive, strength, painScale, compensation };
  }
  return movements;
}

function parsePainTriggers(raw: unknown): PainTriggerEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: PainTriggerEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const note = typeof record.note === "string" ? record.note.trim() : "";
    const painScale =
      typeof record.painScale === "number" &&
      Number.isInteger(record.painScale) &&
      record.painScale >= 0 &&
      record.painScale <= 10
        ? record.painScale
        : null;
    if (!note && painScale == null) continue;
    entries.push({ note, painScale });
  }
  return entries;
}

export async function GET(
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
  const assessments = await listAssessmentsByMember(idNum);
  return NextResponse.json({ assessments });
}

export async function POST(
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
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        evaluatorName?: unknown;
        evaluatedAt?: unknown;
        movements?: unknown;
        coreNote?: unknown;
        squatNote?: unknown;
        overheadSquatNote?: unknown;
        pushupNote?: unknown;
        hipHingeNote?: unknown;
        painTriggers?: unknown;
      }
    | null;

  const evaluatorName = typeof body?.evaluatorName === "string" ? body.evaluatorName.trim() : "";
  const evaluatedAt = typeof body?.evaluatedAt === "string" ? body.evaluatedAt.trim() : "";
  const movements = parseMovements(body?.movements);
  const coreNote = typeof body?.coreNote === "string" ? body.coreNote.trim() : "";
  const squatNote = typeof body?.squatNote === "string" ? body.squatNote.trim() : "";
  const overheadSquatNote =
    typeof body?.overheadSquatNote === "string" ? body.overheadSquatNote.trim() : "";
  const pushupNote = typeof body?.pushupNote === "string" ? body.pushupNote.trim() : "";
  const hipHingeNote = typeof body?.hipHingeNote === "string" ? body.hipHingeNote.trim() : "";
  const painTriggers = parsePainTriggers(body?.painTriggers);

  const assessment = await createAssessment({
    memberId: idNum,
    evaluatorName,
    evaluatedAt,
    movements,
    coreNote,
    squatNote,
    overheadSquatNote,
    pushupNote,
    hipHingeNote,
    painTriggers,
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
