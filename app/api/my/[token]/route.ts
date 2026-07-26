import { NextRequest, NextResponse } from "next/server";
import {
  computeMemberProgress,
  getCoachAvailability,
  getMemberByToken,
  listMemberSessions,
} from "@/lib/schedule";
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

  const [progress, sessions, availability] = await Promise.all([
    computeMemberProgress(member.id),
    listMemberSessions(member.id),
    member.coach_id
      ? getCoachAvailability(member.coach_id, koreaTodayKey(), 14)
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    member: { name: member.name, status: member.status },
    progress,
    sessions,
    availability,
  });
}
