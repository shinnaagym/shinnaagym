import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAssessmentById, updateAssessment, deleteAssessment } from "@/lib/assessments";
import { parseMovements, parsePainTriggers } from "@/lib/assessment-validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const assessment = await getAssessmentById(assessmentIdNum);
  if (!assessment || assessment.member_id !== idNum) {
    return NextResponse.json({ error: "평가 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ assessment });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const existing = await getAssessmentById(assessmentIdNum);
  if (!existing || existing.member_id !== idNum) {
    return NextResponse.json({ error: "평가 기록을 찾을 수 없습니다." }, { status: 404 });
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

  const assessment = await updateAssessment(assessmentIdNum, {
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

  return NextResponse.json({ assessment });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const existing = await getAssessmentById(assessmentIdNum);
  if (!existing || existing.member_id !== idNum) {
    return NextResponse.json({ error: "평가 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  await deleteAssessment(assessmentIdNum);
  return NextResponse.json({ ok: true });
}
