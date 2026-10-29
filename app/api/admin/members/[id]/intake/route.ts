import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById, updateMember } from "@/lib/schedule";
import {
  deleteIntakeQuestionnaire,
  getIntakeQuestionnaireByMember,
  upsertIntakeQuestionnaire,
} from "@/lib/intake";
import { parseIntakeInput } from "@/lib/intake-validation";
import { createAssessment } from "@/lib/assessments";
import { koreaTodayKey } from "@/lib/date";
import { recordUndo, type UndoOp } from "@/lib/undo";
import type { IntakeQuestionnaireRow } from "@/lib/db";

// pain_movements/pain_characteristics/sleep_positions는 JSONB 배열 컬럼이라,
// pg가 JS 배열을 Postgres 네이티브 배열로 오인하지 않도록 직접
// JSON.stringify해서 넘긴다.
function intakeRowForSql(row: IntakeQuestionnaireRow): Record<string, unknown> {
  return {
    ...row,
    pain_movements: JSON.stringify(row.pain_movements),
    pain_characteristics: JSON.stringify(row.pain_characteristics),
    sleep_positions: JSON.stringify(row.sleep_positions),
  };
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
  const intake = await getIntakeQuestionnaireByMember(idNum);
  return NextResponse.json({ intake });
}

export async function PUT(
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
  const parsed = parseIntakeInput(body);

  const before = await getIntakeQuestionnaireByMember(idNum);
  const intake = await upsertIntakeQuestionnaire({ memberId: idNum, ...parsed });

  const undoOps: UndoOp[] = [];
  if (before) {
    const { id: _id, member_id: _memberId, ...prevRest } = intakeRowForSql(before);
    undoOps.push({ op: "update", table: "intake_questionnaires", id: idNum, idColumn: "member_id", data: prevRest });
  } else {
    undoOps.push({ op: "delete", table: "intake_questionnaires", id: idNum, idColumn: "member_id" });
  }

  // 통증의 강도(NRS)에서 "현재" 값을 적어둔 동작은, 평가지의 통증 척도
  // 그래프에도 그대로 반영되도록 통증 유발 동작 기록(assessments)을 함께
  // 남긴다 — PT 일지의 "통증 유발 동작 기록" 섹션과 같은 방식.
  const currentPainEntries = parsed.painMovements
    .filter((m) => m.movement.trim() && m.nrsCurrent != null)
    .map((m) => ({ note: m.movement.trim(), painScale: m.nrsCurrent }));

  if (currentPainEntries.length > 0) {
    const assessment = await createAssessment({
      memberId: idNum,
      evaluatedAt: koreaTodayKey(),
      movements: {},
      painTriggers: currentPainEntries,
    });
    undoOps.push({ op: "delete", table: "assessments", id: assessment.id });
  }

  // 문진표에 "소개"로 적은 분 성함을 회원 정보의 소개자 칸에도 그대로
  // 동기화한다 — 문진표에만 적어두고 회원 정보에는 깜빡 빠뜨리는 경우가
  // 많았다. 경로가 "소개"가 아니거나 성함을 안 적었으면 건드리지
  // 않는다(이미 적혀있는 소개자 정보를 실수로 지우지 않기 위함).
  const referrerName = parsed.visitChannelReferrerName.trim();
  if (parsed.visitChannel === "referral" && referrerName && member.referrer !== referrerName) {
    undoOps.push({ op: "update", table: "members", id: idNum, data: { referrer: member.referrer } });
    await updateMember(idNum, { referrer: referrerName });
  }

  await recordUndo(`${member.name} 초진 문진표 ${before ? "수정" : "작성"}`, undoOps);

  return NextResponse.json({ intake });
}

export async function DELETE(
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
  const before = await getIntakeQuestionnaireByMember(idNum);
  await deleteIntakeQuestionnaire(idNum);
  if (before) {
    await recordUndo("초진 문진표 삭제", [
      { op: "insert", table: "intake_questionnaires", data: intakeRowForSql(before) },
    ]);
  }
  return NextResponse.json({ ok: true });
}
