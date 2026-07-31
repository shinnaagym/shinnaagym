import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import {
  deleteIntakeQuestionnaire,
  getIntakeQuestionnaireByMember,
  upsertIntakeQuestionnaire,
} from "@/lib/intake";
import { parseIntakeInput } from "@/lib/intake-validation";
import { recordUndo } from "@/lib/undo";
import type { IntakeQuestionnaireRow } from "@/lib/db";

// pain_movements/pain_characteristics는 JSONB 배열 컬럼이라, pg가 JS 배열을
// Postgres 네이티브 배열로 오인하지 않도록 직접 JSON.stringify해서 넘긴다.
function intakeRowForSql(row: IntakeQuestionnaireRow): Record<string, unknown> {
  return {
    ...row,
    pain_movements: JSON.stringify(row.pain_movements),
    pain_characteristics: JSON.stringify(row.pain_characteristics),
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

  if (before) {
    const { id: _id, member_id: _memberId, ...prevRest } = intakeRowForSql(before);
    await recordUndo(`${member.name} 초진 문진표 수정`, [
      { op: "update", table: "intake_questionnaires", id: idNum, idColumn: "member_id", data: prevRest },
    ]);
  } else {
    await recordUndo(`${member.name} 초진 문진표 작성`, [
      { op: "delete", table: "intake_questionnaires", id: idNum, idColumn: "member_id" },
    ]);
  }

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
