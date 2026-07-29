import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addPackage, createMember, getMemberById, getMemberByPhone, listMembers, updateMember } from "@/lib/schedule";
import { createContract } from "@/lib/contracts";
import type { PaymentMethod, PtType, VisitChannel } from "@/lib/db";

const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["card", "transfer"];
const VALID_VISIT_CHANNELS: VisitChannel[] = [
  "naver",
  "instagram",
  "danggeun",
  "cafe",
  "flyer",
  "referral",
  "other",
  "",
];

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const members = await listMembers();
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        phone?: unknown;
        coachId?: unknown;
        notes?: unknown;
        referrer?: unknown;
        availableTimes?: unknown;
        totalSessions?: unknown;
        price?: unknown;
        ptType?: unknown;
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
      }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const referrer = typeof body?.referrer === "string" ? body.referrer.trim() : "";
  const availableTimes =
    typeof body?.availableTimes === "string" ? body.availableTimes.trim() : "";
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId)
      ? body.coachId
      : null;

  const totalSessions = Number(body?.totalSessions ?? 0);
  const price = Number(body?.price ?? 0);
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    return NextResponse.json({ error: "등록 횟수를 올바르게 입력해주세요." }, { status: 400 });
  }
  const ptType: PtType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : "1:1";
  const paymentMethod: PaymentMethod =
    typeof body?.paymentMethod === "string" &&
    VALID_PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : "card";

  // 계약서 전용 필드 — 전부 선택 입력(등록 당시 정보가 부족해도 등록 자체는 막지 않는다).
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

  // 같은 연락처로 상담 단계(초진 문진표/평가지 등)에서 이미 만들어진 회원 레코드가
  // 있으면 새로 만들지 않고 그 회원에 패키지·계약서를 연결한다 — 상담 시 작성한
  // 문진표/평가지가 신규 등록 후에도 회원 정보에 그대로 남도록 하기 위함.
  const existingMember = await getMemberByPhone(phone);
  let member;
  if (existingMember) {
    await updateMember(existingMember.id, { name, phone, coachId, notes, referrer, availableTimes });
    member = (await getMemberById(existingMember.id))!;
  } else {
    member = await createMember({ name, phone, coachId, notes, referrer, availableTimes });
  }
  await addPackage(member.id, totalSessions, price, "최초 등록", ptType, paymentMethod);
  await createContract({
    memberId: member.id,
    entryType: "new",
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
  });

  return NextResponse.json({ member }, { status: 201 });
}
