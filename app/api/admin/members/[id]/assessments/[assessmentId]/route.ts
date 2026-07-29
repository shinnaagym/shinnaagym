import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAssessmentById, updateAssessment, deleteAssessment } from "@/lib/assessments";
import { parseAssessmentInput } from "@/lib/assessment-validation";
import { recordUndo } from "@/lib/undo";
import type { AssessmentRow } from "@/lib/db";

// assessments의 JSONB 컬럼 중 배열 타입(pain_triggers, exercise_performance)은 pg가
// 파라미터로 넘어온 JS 배열을 Postgres 네이티브 배열 리터럴로 취급해버리므로, JSONB
// 배열 문법으로 저장되도록 직접 JSON.stringify해서 넘겨야 한다(다른 JSONB 컬럼은
// 전부 객체라 pg가 자동으로 JSON.stringify 처리해준다).
function assessmentRowForSql(a: AssessmentRow): Record<string, unknown> {
  return {
    ...a,
    pain_triggers: JSON.stringify(a.pain_triggers),
    exercise_performance: JSON.stringify(a.exercise_performance),
  };
}

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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseAssessmentInput(body);

  const assessment = await updateAssessment(assessmentIdNum, parsed);

  // 컬럼이 매우 많아 바뀐 필드만 골라내는 대신, 되돌릴 때는 id를 제외한
  // 전체 컬럼을 수정 전 값으로 한 번에 복원한다.
  const { id: _prevId, ...prevRest } = assessmentRowForSql(existing);
  await recordUndo("체형평가 수정", [
    { op: "update", table: "assessments", id: assessmentIdNum, data: prevRest },
  ]);

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
  await recordUndo("체형평가 삭제", [
    { op: "insert", table: "assessments", data: assessmentRowForSql(existing) },
  ]);
  return NextResponse.json({ ok: true });
}
