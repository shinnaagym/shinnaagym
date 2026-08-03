import { NextRequest, NextResponse } from "next/server";
import { getMemberByToken } from "@/lib/schedule";
import { createPersonalExercise, listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { parseExercises } from "@/lib/pt-log-validation";
import { koreaTodayKey } from "@/lib/date";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }
  const personalExercises = await listPersonalExercisesByMember(member.id);
  return NextResponse.json({ personalExercises });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const logDate =
    typeof body?.logDate === "string" && body.logDate ? body.logDate : koreaTodayKey();
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const exercises = parseExercises(body?.exercises);

  const personalExercise = await createPersonalExercise({
    memberId: member.id,
    logDate,
    memo,
    exercises,
  });

  return NextResponse.json({ personalExercise }, { status: 201 });
}
