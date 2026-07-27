import { NextResponse } from "next/server";
import { getMemberByToken } from "@/lib/schedule";
import { getLatestContractByMember } from "@/lib/contracts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }
  const contract = await getLatestContractByMember(member.id);
  return NextResponse.json({ contract });
}
