import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createPtLog, listPtLogsByMember } from "@/lib/pt-logs";
import { parseExercises, parseScale } from "@/lib/pt-log-validation";
import { createAssessment } from "@/lib/assessments";
import { computeE1rm } from "@/lib/exercise-performance";
import { PT_LOG_EQUIPMENT_LABELS } from "@/lib/constants";
import { recordUndo, type UndoOp } from "@/lib/undo";
import { koreaTodayKey } from "@/lib/date";
import type { ExercisePerformanceEntry, PainTriggerEntry, PtLogExercise } from "@/lib/db";

/**
 * PT 일지에 적은 운동마다 "그날 가장 무거웠던 세트"를 하나씩 골라 평가 기록의
 * 운동 수행능력(e1RM) 항목으로 변환한다 — 평가지 그래프와 PT 일지가 같은
 * 데이터를 공유하도록 하기 위함. 무게·횟수가 있는 세트가 하나도 없는 운동
 * (맨몸 운동 등)은 건너뛴다.
 */
function topSetExercisePerformance(exercises: PtLogExercise[]): ExercisePerformanceEntry[] {
  const entries: ExercisePerformanceEntry[] = [];
  for (const ex of exercises) {
    let best: { weight: number; reps: number; e1rm: number } | null = null;
    for (const g of ex.groups) {
      const e1rm = computeE1rm(g.weight, g.reps);
      if (e1rm == null || g.weight == null || g.reps == null) continue;
      if (!best || e1rm > best.e1rm) best = { weight: g.weight, reps: g.reps, e1rm };
    }
    if (!best) continue;
    entries.push({
      exercise: ex.name,
      note: PT_LOG_EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment,
      weight: best.weight,
      reps: best.reps,
      rpe: null,
    });
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

  // 통증 척도·운동수행 능력이 평가지(평가 기록)의 그래프와 같은 데이터를
  // 쓰도록, PT 일지에 적은 통증 점수·운동 기록을 평가 기록에도 함께 남긴다.
  const painTriggers: PainTriggerEntry[] = painNote || painScale != null ? [{ note: painNote, painScale }] : [];
  const exercisePerformance = topSetExercisePerformance(exercises);
  if (painTriggers.length > 0 || exercisePerformance.length > 0) {
    const assessment = await createAssessment({
      memberId: idNum,
      evaluatedAt: logDate,
      movements: {},
      painTriggers,
      exercisePerformance,
    });
    ops.push({ op: "delete", table: "assessments", id: assessment.id });
  }

  await recordUndo(`${member.name} PT 일지 작성`, ops);

  return NextResponse.json({ ptLog }, { status: 201 });
}
