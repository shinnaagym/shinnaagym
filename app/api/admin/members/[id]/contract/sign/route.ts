import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getLatestContractByMember, signContract } from "@/lib/contracts";

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

  const body = (await req.json().catch(() => null)) as { signatureDataUrl?: unknown } | null;
  const signatureDataUrl =
    typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : "";
  if (!signatureDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "서명을 다시 그려주세요." }, { status: 400 });
  }

  const contract = await getLatestContractByMember(idNum);
  if (!contract) {
    return NextResponse.json({ error: "서명할 계약서가 없어요." }, { status: 404 });
  }
  if (contract.signed_at) {
    return NextResponse.json({ error: "이미 서명이 완료된 계약서예요." }, { status: 409 });
  }

  const signed = await signContract(contract.id, signatureDataUrl);
  return NextResponse.json({ contract: signed });
}
