import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createAssessment, listAssessmentsByMember } from "@/lib/assessments";
import { parseExercisePerformance, parseMovements, parsePainTriggers } from "@/lib/assessment-validation";

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
        exercisePerformance?: unknown;
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
  const exercisePerformance = parseExercisePerformance(body?.exercisePerformance);

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
    exercisePerformance,
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
