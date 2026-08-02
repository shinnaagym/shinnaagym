import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createPtLog, listPtLogsByMember } from "@/lib/pt-logs";
import { parseExercises, parseScale } from "@/lib/pt-log-validation";
import { createAssessment } from "@/lib/assessments";
import { recordUndo, type UndoOp } from "@/lib/undo";
import { koreaTodayKey } from "@/lib/date";
import type { PainTriggerEntry } from "@/lib/db";

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
  const ptLogs = await listPtLogsByMember(idNum);
  return NextResponse.json({ ptLogs });
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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const logDate =
    typeof body?.logDate === "string" && body.logDate ? body.logDate : koreaTodayKey();
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const painNote = typeof body?.painNote === "string" ? body.painNote.trim() : "";
  const painScale = parseScale(body?.painScale);
  const exercises = parseExercises(body?.exercises);

  const ptLog = await createPtLog({
    memberId: idNum,
    logDate,
    memo,
    painScale,
    performanceScale: null,
    exercises,
  });

  const ops: UndoOp[] = [{ op: "delete", table: "pt_logs", id: ptLog.id }];

  // 통증 척도가 평가지(평가 기록)의 그래프와 같은 데이터를 쓰도록, PT 일지에
  // 적은 통증 점수를 평가 기록에도 함께 남긴다. (운동 수행능력은 PT 일지에서
  // 별도의 "운동 수행능력 평가" 섹션으로만 기록되며, 여기 적은 세트/무게는
  // 그래프에 반영되지 않는다.)
  const painTriggers: PainTriggerEntry[] = painNote || painScale != null ? [{ note: painNote, painScale }] : [];
  if (painTriggers.length > 0) {
    const assessment = await createAssessment({
      memberId: idNum,
      evaluatedAt: logDate,
      movements: {},
      painTriggers,
      exercisePerformance: [],
    });
    ops.push({ op: "delete", table: "assessments", id: assessment.id });
  }

  await recordUndo(`${member.name} PT 일지 작성`, ops);

  return NextResponse.json({ ptLog }, { status: 201 });
}
