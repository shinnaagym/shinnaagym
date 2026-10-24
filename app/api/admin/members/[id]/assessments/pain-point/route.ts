import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { findAssessmentForPainPoint, updatePainPoint } from "@/lib/assessments";
import { recordUndo } from "@/lib/undo";
import type { AssessmentRow } from "@/lib/db";

// assessments의 JSONB 배열 컬럼(pain_triggers, exercise_performance)은 pg가 JS
// 배열을 Postgres 네이티브 배열 리터럴로 취급해버리므로, 되돌릴 때 직접
// JSON.stringify해서 넘겨야 한다([id]/route.ts의 assessmentRowForSql과 동일).
function assessmentRowForSql(a: AssessmentRow): Record<string, unknown> {
  return {
    ...a,
    pain_triggers: JSON.stringify(a.pain_triggers),
    exercise_performance: JSON.stringify(a.exercise_performance),
  };
}

/** 통증 척도 그래프에서 점 하나를 수정/삭제한다. painScale이 null이면 삭제. */
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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const seriesKey = typeof body?.seriesKey === "string" ? body.seriesKey : "";
  const painScale =
    body?.painScale === null
      ? null
      : typeof body?.painScale === "number" && Number.isFinite(body.painScale)
        ? body.painScale
        : undefined;
  if (!date || !seriesKey || painScale === undefined) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await findAssessmentForPainPoint(idNum, date, seriesKey);
  if (!target) {
    return NextResponse.json({ error: "해당 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const before = target.assessment;
  const assessment = await updatePainPoint(target, seriesKey, painScale);

  const { id: _prevId, ...prevRest } = assessmentRowForSql(before);
  await recordUndo(painScale == null ? "통증 척도 기록 삭제" : "통증 척도 기록 수정", [
    { op: "update", table: "assessments", id: before.id, data: prevRest },
  ]);

  return NextResponse.json({ assessment });
}
