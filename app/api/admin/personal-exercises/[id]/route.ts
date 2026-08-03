import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  deletePersonalExercise,
  getPersonalExerciseById,
  updatePersonalExercise,
} from "@/lib/personal-exercises";
import { parseExercises } from "@/lib/pt-log-validation";
import { recordUndo } from "@/lib/undo";
import { koreaTodayKey } from "@/lib/date";
import type { PersonalExerciseRow } from "@/lib/db";

function personalExerciseRowForSql(row: PersonalExerciseRow): Record<string, unknown> {
  return { ...row, exercises: JSON.stringify(row.exercises) };
}

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
  const existing = await getPersonalExerciseById(idNum);
  if (!existing) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const logDate =
    typeof body?.logDate === "string" && body.logDate ? body.logDate : koreaTodayKey();
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const exercises = parseExercises(body?.exercises);

  const personalExercise = await updatePersonalExercise(idNum, { logDate, memo, exercises });

  const { id: _prevId, ...prevRest } = personalExerciseRowForSql(existing);
  await recordUndo("개인 운동 수정", [
    { op: "update", table: "personal_exercises", id: idNum, data: prevRest },
  ]);

  return NextResponse.json({ personalExercise });
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
  const personalExercise = await getPersonalExerciseById(idNum);
  if (!personalExercise) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  await deletePersonalExercise(idNum);
  await recordUndo("개인 운동 삭제", [
    { op: "insert", table: "personal_exercises", data: personalExerciseRowForSql(personalExercise) },
  ]);
  return NextResponse.json({ ok: true });
}
