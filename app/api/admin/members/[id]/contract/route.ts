import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById, listPackages } from "@/lib/schedule";
import { createContract, getLatestContractByMember, updateContract } from "@/lib/contracts";
import { recordUndo } from "@/lib/undo";
import { VISIT_CHANNEL_OPTIONS } from "@/lib/intake-questionnaire";
import type { PaymentMethod, PtType, VisitChannel } from "@/lib/db";

const VALID_VISIT_CHANNELS: VisitChannel[] = [
  ...VISIT_CHANNEL_OPTIONS.map((opt) => opt.value),
  "",
];
const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["card", "transfer"];

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
        companionRrnFront?: unknown;
        companionAddress?: unknown;
        companionPrivacyConsent?: unknown;
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
  const companionRrnFront =
    typeof body?.companionRrnFront === "string" ? body.companionRrnFront.trim() : "";
  const companionAddress =
    typeof body?.companionAddress === "string" ? body.companionAddress.trim() : "";
  const companionPrivacyConsent = body?.companionPrivacyConsent === true;

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
    companionRrnFront,
    companionAddress,
    companionPrivacyConsent,
  });

  await recordUndo(`${member.name} 계약서 작성`, [
    { op: "delete", table: "contracts", id: contract.id },
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** 이미 작성된 계약서의 오타·변경사항을 관리자가 직접 고칠 때 쓴다(서명
    여부와 무관하게 수정 가능 — 성명·연락처는 회원 레코드 쪽이라 이 API가
    아니라 `/api/admin/members/[id]`에서 함께 바꾼다). */
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
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const existing = await getLatestContractByMember(idNum);
  if (!existing) {
    return NextResponse.json({ error: "계약서가 없어요." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        ptType?: unknown;
        totalSessions?: unknown;
        price?: unknown;
        paymentMethod?: unknown;
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
        companionRrnFront?: unknown;
        companionAddress?: unknown;
        companionPrivacyConsent?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ptType: PtType =
    typeof body.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : existing.pt_type;
  const totalSessions = Number(body.totalSessions);
  if (!Number.isInteger(totalSessions) || totalSessions <= 0) {
    return NextResponse.json({ error: "등록 횟수를 올바르게 입력해주세요." }, { status: 400 });
  }
  const price = Number(body.price);
  if (!Number.isInteger(price) || price < 0) {
    return NextResponse.json({ error: "결제 금액을 올바르게 입력해주세요." }, { status: 400 });
  }
  const paymentMethod: PaymentMethod =
    typeof body.paymentMethod === "string" &&
    VALID_PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : existing.payment_method;
  const rrnFront = typeof body.rrnFront === "string" ? body.rrnFront.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const visitChannel: VisitChannel =
    typeof body.visitChannel === "string" &&
    VALID_VISIT_CHANNELS.includes(body.visitChannel as VisitChannel)
      ? (body.visitChannel as VisitChannel)
      : "";
  const visitChannelReferrerName =
    typeof body.visitChannelReferrerName === "string" ? body.visitChannelReferrerName.trim() : "";
  const visitChannelOther = typeof body.visitChannelOther === "string" ? body.visitChannelOther.trim() : "";
  const purposes = Array.isArray(body.purposes)
    ? body.purposes.filter((p): p is string => typeof p === "string")
    : [];
  const purposeOther = typeof body.purposeOther === "string" ? body.purposeOther.trim() : "";
  const optionNote = typeof body.optionNote === "string" ? body.optionNote.trim() : "";
  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const privacyConsent = body.privacyConsent === true;
  const companionName = typeof body.companionName === "string" ? body.companionName.trim() : "";
  const companionPhone = typeof body.companionPhone === "string" ? body.companionPhone.trim() : "";
  const companionRrnFront =
    typeof body.companionRrnFront === "string" ? body.companionRrnFront.trim() : "";
  const companionAddress = typeof body.companionAddress === "string" ? body.companionAddress.trim() : "";
  const companionPrivacyConsent = body.companionPrivacyConsent === true;

  const before = existing;
  await updateContract(existing.id, {
    ptType,
    totalSessions,
    price,
    paymentMethod,
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
    companionRrnFront,
    companionAddress,
    companionPrivacyConsent,
  });

  await recordUndo(`${member.name} 계약서 수정`, [
    {
      op: "update",
      table: "contracts",
      id: before.id,
      data: {
        pt_type: before.pt_type,
        total_sessions: before.total_sessions,
        price: before.price,
        payment_method: before.payment_method,
        rrn_front_encrypted: before.rrn_front_encrypted,
        address: before.address,
        visit_channel: before.visit_channel,
        visit_channel_referrer_name: before.visit_channel_referrer_name,
        visit_channel_other: before.visit_channel_other,
        purposes: before.purposes,
        purpose_other: before.purpose_other,
        option_note: before.option_note,
        start_date: before.start_date,
        privacy_consent: before.privacy_consent,
        companion_name: before.companion_name,
        companion_phone: before.companion_phone,
        companion_rrn_front_encrypted: before.companion_rrn_front_encrypted,
        companion_address: before.companion_address,
        companion_privacy_consent: before.companion_privacy_consent,
      },
    },
  ]);

  return NextResponse.json({ ok: true });
}
