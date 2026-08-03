import { NextRequest, NextResponse } from "next/server";
import { getMemberByToken } from "@/lib/schedule";
import {
  deletePersonalExercise,
  getPersonalExerciseById,
  updatePersonalExercise,
} from "@/lib/personal-exercises";
import { parseExercises } from "@/lib/pt-log-validation";
import { koreaTodayKey } from "@/lib/date";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }
  const existing = await getPersonalExerciseById(idNum);
  if (!existing || existing.member_id !== member.id) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const logDate =
    typeof body?.logDate === "string" && body.logDate ? body.logDate : koreaTodayKey();
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const exercises = parseExercises(body?.exercises);

  const personalExercise = await updatePersonalExercise(idNum, { logDate, memo, exercises });
  return NextResponse.json({ personalExercise });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }
  const existing = await getPersonalExerciseById(idNum);
  if (!existing || existing.member_id !== member.id) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  await deletePersonalExercise(idNum);
  return NextResponse.json({ ok: true });
}
