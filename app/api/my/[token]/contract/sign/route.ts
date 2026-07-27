import { NextRequest, NextResponse } from "next/server";
import { getMemberByToken } from "@/lib/schedule";
import { getLatestContractByMember, signContract } from "@/lib/contracts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { signatureDataUrl?: unknown } | null;
  const signatureDataUrl =
    typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : "";
  if (!signatureDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "서명을 다시 그려주세요." }, { status: 400 });
  }

  const contract = await getLatestContractByMember(member.id);
  if (!contract) {
    return NextResponse.json({ error: "서명할 계약서가 없어요." }, { status: 404 });
  }
  if (contract.signed_at) {
    return NextResponse.json({ error: "이미 서명이 완료된 계약서예요." }, { status: 409 });
  }

  const signed = await signContract(contract.id, signatureDataUrl);
  return NextResponse.json({ contract: signed });
}
