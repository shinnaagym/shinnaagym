import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById, listPackages } from "@/lib/schedule";
import { createContract, getLatestContractByMember } from "@/lib/contracts";
import { recordUndo } from "@/lib/undo";
import { VISIT_CHANNEL_OPTIONS } from "@/lib/intake-questionnaire";
import type { VisitChannel } from "@/lib/db";

const VALID_VISIT_CHANNELS: VisitChannel[] = [
  ...VISIT_CHANNEL_OPTIONS.map((opt) => opt.value),
  "",
];

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
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const contract = await getLatestContractByMember(idNum);
  if (!contract) {
    return NextResponse.json({ error: "계약서가 없어요." }, { status: 404 });
  }
  return NextResponse.json({
    member: { name: member.name, phone: member.phone },
    contract,
  });
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
  const existing = await getLatestContractByMember(idNum);
  if (existing) {
    return NextResponse.json({ error: "이미 계약서가 있는 회원이에요." }, { status: 409 });
  }
  // 회원권 유형/횟수/금액/결제수단은 가장 최근 패키지 정보를 그대로 가져와 채운다.
  const packages = await listPackages(idNum);
  const latestPackage = packages[packages.length - 1];
  if (!latestPackage) {
    return NextResponse.json(
      { error: "결제 이력이 있어야 계약서를 작성할 수 있어요." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | {
        rrnFront?: unknown;
        address?: unknown;
        visitChannel?: unknown;
        visitChannelReferrerName?: unknown;
        visitChannelOther?: unknown;
        purposes?: unknown;
        purposeOther?: unknown;
        optionNote?: unknown;
        startDate?: unknown;
        privacyConsent?: unknown;
        companionName?: unknown;
        companionPhone?: unknown;
      }
    | null;

  const rrnFront = typeof body?.rrnFront === "string" ? body.rrnFront.trim() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const visitChannel: VisitChannel =
    typeof body?.visitChannel === "string" &&
    VALID_VISIT_CHANNELS.includes(body.visitChannel as VisitChannel)
      ? (body.visitChannel as VisitChannel)
      : "";
  const visitChannelReferrerName =
    typeof body?.visitChannelReferrerName === "string"
      ? body.visitChannelReferrerName.trim()
      : "";
  const visitChannelOther =
    typeof body?.visitChannelOther === "string" ? body.visitChannelOther.trim() : "";
  const purposes = Array.isArray(body?.purposes)
    ? body.purposes.filter((p): p is string => typeof p === "string")
    : [];
  const purposeOther = typeof body?.purposeOther === "string" ? body.purposeOther.trim() : "";
  const optionNote = typeof body?.optionNote === "string" ? body.optionNote.trim() : "";
  const startDate = typeof body?.startDate === "string" ? body.startDate.trim() : "";
  const privacyConsent = body?.privacyConsent === true;
  const companionName = typeof body?.companionName === "string" ? body.companionName.trim() : "";
  const companionPhone = typeof body?.companionPhone === "string" ? body.companionPhone.trim() : "";

  const contract = await createContract({
    memberId: idNum,
    entryType: "new",
    ptType: latestPackage.pt_type,
    totalSessions: latestPackage.total_sessions,
    price: latestPackage.price,
    paymentMethod: latestPackage.payment_method,
    rrnFront,
    address,
    visitChannel,
    visitChannelReferrerName,
    visitChannelOther,
    purposes,
    purposeOther,
    optionNote,
    startDate,
    privacyConsent,
    companionName,
    companionPhone,
  });

  await recordUndo(`${member.name} 계약서 작성`, [
    { op: "delete", table: "contracts", id: contract.id },
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
