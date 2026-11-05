import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { addCoachReferralEntry, listCoachReferralEntries } from "@/lib/payroll";

async function requirePayrollAccess() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isPayrollAuthed())) {
    return NextResponse.json({ error: "급여 계산 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const coachId = Number(searchParams.get("coachId"));
  if (!Number.isInteger(coachId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const entries = await listCoachReferralEntries(coachId);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | { coachId?: unknown; note?: unknown; amount?: unknown }
    | null;

  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId) ? body.coachId : null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const amount =
    typeof body?.amount === "number" && Number.isFinite(body.amount) && body.amount >= 0
      ? body.amount
      : null;

  if (coachId === null || amount === null || (!note && amount <= 0)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const entry = await addCoachReferralEntry(coachId, note, amount);
  return NextResponse.json({ entry });
}
