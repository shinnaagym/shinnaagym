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

  const personalExercise = await createPersonalExercise({
    memberId: idNum,
    logDate,
    memo,
    exercises,
  });

  const ops: UndoOp[] = [{ op: "delete", table: "personal_exercises", id: personalExercise.id }];
  await recordUndo(`${member.name} 개인 운동 작성`, ops);

  return NextResponse.json({ personalExercise }, { status: 201 });
}
