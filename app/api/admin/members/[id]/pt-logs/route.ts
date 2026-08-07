import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createPtLog, listPtLogsByMember } from "@/lib/pt-logs";
import { parseExercises, parsePerformanceEntries, parseScale } from "@/lib/pt-log-validation";
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
  // 세트마다 "그래프 기록"을 체크해 함께 넘어오는 운동 수행능력(e1RM) 항목 —
  // PT 일지 작성 폼이 예전엔 이걸 별도 요청으로 평가 기록에 남겼는데, 2:1 짝
  // 동기화를 여기 한 곳에서만 처리하려고 같은 요청에 실어 받는다.
  const performanceEntries = parsePerformanceEntries(body?.performanceEntries);

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
  // 적은 통증 점수를 평가 기록에도 함께 남긴다.
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
  if (performanceEntries.length > 0) {
    const assessment = await createAssessment({
      memberId: idNum,
      evaluatedAt: logDate,
      movements: {},
      exercisePerformance: performanceEntries,
    });
    ops.push({ op: "delete", table: "assessments", id: assessment.id });
  }

  // 2:1 PT로 짝지어진 회원이 있으면, 같은 운동 기록·메모를 짝의 PT 일지에도
  // 독립된 행으로 복사해 각자 페이지에서 확인·수정할 수 있게 한다. 작성
  // "시점"에만 한 번 복사하며, 이후 어느 한쪽을 수정해도 서로 반영되지 않는다.
  if (member.duo_partner_id != null) {
    const partnerPtLog = await createPtLog({
      memberId: member.duo_partner_id,
      logDate,
      memo,
      painScale,
      performanceScale: null,
      exercises,
    });
    ops.push({ op: "delete", table: "pt_logs", id: partnerPtLog.id });

    if (painTriggers.length > 0) {
      const partnerAssessment = await createAssessment({
        memberId: member.duo_partner_id,
        evaluatedAt: logDate,
        movements: {},
        painTriggers,
        exercisePerformance: [],
      });
      ops.push({ op: "delete", table: "assessments", id: partnerAssessment.id });
    }
    if (performanceEntries.length > 0) {
      const partnerAssessment = await createAssessment({
        memberId: member.duo_partner_id,
        evaluatedAt: logDate,
        movements: {},
        exercisePerformance: performanceEntries,
      });
      ops.push({ op: "delete", table: "assessments", id: partnerAssessment.id });
    }
  }

  await recordUndo(`${member.name} PT 일지 작성`, ops);

  return NextResponse.json({ ptLog }, { status: 201 });
}
