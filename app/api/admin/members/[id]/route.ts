import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  computeMemberProgress,
  deleteMember,
  getMemberById,
  listPackages,
  listMemberSessions,
  updateMember,
} from "@/lib/schedule";
import { getLatestContractByMember } from "@/lib/contracts";
import { listAssessmentsByMember } from "@/lib/assessments";
import type { MemberStatus } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const [progress, packages, sessions, fullContract, assessments] = await Promise.all([
    computeMemberProgress(idNum),
    listPackages(idNum),
    listMemberSessions(idNum),
    getLatestContractByMember(idNum),
    listAssessmentsByMember(idNum),
  ]);
  // 민감한 필드(주민등록번호 앞자리, 서명 이미지)는 이 요약 응답에는 담지 않는다.
  const contract = fullContract
    ? { id: fullContract.id, entryType: fullContract.entry_type, signedAt: fullContract.signed_at }
    : null;
  const assessmentSummary = {
    count: assessments.length,
    latestAt: assessments[0]?.evaluated_at || assessments[0]?.created_at || null,
  };
  return NextResponse.json({
    member,
    progress,
    packages,
    sessions,
    contract,
    assessmentSummary,
  });
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
  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        phone?: unknown;
        coachId?: unknown;
        notes?: unknown;
        referrer?: unknown;
        availableTimes?: unknown;
        followupStatus?: unknown;
        followupMemo?: unknown;
        improvementDirection?: unknown;
        status?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const VALID_FOLLOWUP_STATUSES = ["대기", "연락함", "재등록 확정", "보류", "이탈"];

  await updateMember(idNum, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
    coachId:
      body.coachId === null
        ? null
        : typeof body.coachId === "number"
          ? body.coachId
          : undefined,
    notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer.trim() : undefined,
    availableTimes:
      typeof body.availableTimes === "string" ? body.availableTimes.trim() : undefined,
    followupStatus:
      typeof body.followupStatus === "string" &&
      VALID_FOLLOWUP_STATUSES.includes(body.followupStatus)
        ? body.followupStatus
        : undefined,
    followupMemo:
      typeof body.followupMemo === "string" ? body.followupMemo.trim() : undefined,
    improvementDirection:
      typeof body.improvementDirection === "string"
        ? body.improvementDirection.trim()
        : undefined,
    status:
      body.status === "active" || body.status === "inactive"
        ? (body.status as MemberStatus)
        : undefined,
  });

  return NextResponse.json({ ok: true });
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
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const packages = await listPackages(idNum);
  if (packages.length > 0) {
    return NextResponse.json(
      { error: "결제 이력이 있는 회원은 삭제할 수 없어요. '비활성'으로 전환해주세요." },
      { status: 400 },
    );
  }
  await deleteMember(idNum);
  return NextResponse.json({ ok: true });
}
