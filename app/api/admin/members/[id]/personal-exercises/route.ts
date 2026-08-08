import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { createPersonalExercise, listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { parseExercises } from "@/lib/pt-log-validation";
import { recordUndo, type UndoOp } from "@/lib/undo";
import { koreaTodayKey } from "@/lib/date";

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
  const personalExercises = await listPersonalExercisesByMember(idNum);
  return NextResponse.json({ personalExercises });
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
  const exercises = parseExercises(body?.exercises);
  // 2:1 짝 탭을 열어 독립적으로 고쳐뒀다면, 폼이 짝의 초안을 여기 실어 보낸다 —
  // PT 일지와 같은 방식(app/api/admin/members/[id]/pt-logs/route.ts 참고).
  const partnerOverride = (body?.partnerOverride ?? null) as Record<string, unknown> | null;
  const partnerMemo =
    partnerOverride && typeof partnerOverride.memo === "string" ? partnerOverride.memo.trim() : null;
  const partnerExercises = partnerOverride ? parseExercises(partnerOverride.exercises) : null;

  const personalExercise = await createPersonalExercise({
    memberId: idNum,
    logDate,
    memo,
    exercises,
  });

  const ops: UndoOp[] = [{ op: "delete", table: "personal_exercises", id: personalExercise.id }];

  // 2:1 PT로 짝지어진 회원이 있으면, 같은 개인 운동 기록을 짝에게도 독립된
  // 행으로 복사해 각자 페이지에서 확인·수정할 수 있게 한다(PT 일지와 동일한
  // 규칙 — 작성 시점에만 1회 복사하며, 이후 어느 한쪽을 수정해도 서로
  // 반영되지 않는다).
  if (member.duo_partner_id != null) {
    const partnerPersonalExercise = await createPersonalExercise({
      memberId: member.duo_partner_id,
      logDate,
      memo: partnerMemo ?? memo,
      exercises: partnerExercises ?? exercises,
    });
    ops.push({ op: "delete", table: "personal_exercises", id: partnerPersonalExercise.id });
  }

  await recordUndo(`${member.name} 개인 운동 작성`, ops);

  return NextResponse.json({ personalExercise }, { status: 201 });
}
