import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { listPayrollRecords, savePayrollRecord, type ReferralEntry } from "@/lib/payroll";
import { calculatePayroll, type AllocationOrder } from "@/lib/payroll/calculate";
import type { EmploymentType } from "@/lib/db";

function parseReferralEntries(value: unknown): ReferralEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: ReferralEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const note = (item as Record<string, unknown>).note;
    const amount = (item as Record<string, unknown>).amount;
    if (typeof note !== "string") return null;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
    entries.push({ note: note.trim(), amount });
  }
  return entries;
}

const VALID_EMPLOYMENT_TYPES: EmploymentType[] = ["regular", "freelancer"];
const VALID_ALLOCATION_ORDERS: AllocationOrder[] = [
  "proportional",
  "1on1-first",
  "2on1-first",
];

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
  const yearMonth = searchParams.get("yearMonth") ?? undefined;
  const coachIdParam = searchParams.get("coachId");
  const coachId = coachIdParam ? Number(coachIdParam) : undefined;
  if (yearMonth && !isValidMonthKey(yearMonth)) {
    return NextResponse.json({ error: "잘못된 정산월입니다." }, { status: 400 });
  }
  if (coachIdParam && !Number.isInteger(coachId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const records = await listPayrollRecords({ yearMonth, coachId });
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | {
        coachId?: unknown;
        employeeName?: unknown;
        yearMonth?: unknown;
        employmentType?: unknown;
        hiredAt?: unknown;
        isTeamLead?: unknown;
        sessionCount1on1?: unknown;
        sessionCount2on1?: unknown;
        referralEntries?: unknown;
        allocationOrder?: unknown;
      }
    | null;

  const employeeName = typeof body?.employeeName === "string" ? body.employeeName.trim() : "";
  const yearMonth = typeof body?.yearMonth === "string" ? body.yearMonth : "";
  const employmentType =
    typeof body?.employmentType === "string" &&
    VALID_EMPLOYMENT_TYPES.includes(body.employmentType as EmploymentType)
      ? (body.employmentType as EmploymentType)
      : null;
  const hiredAt = typeof body?.hiredAt === "string" ? body.hiredAt : "";
  const isTeamLead = body?.isTeamLead === true;
  const sessionCount1on1 =
    typeof body?.sessionCount1on1 === "number" && Number.isFinite(body.sessionCount1on1)
      ? body.sessionCount1on1
      : NaN;
  const sessionCount2on1 =
    typeof body?.sessionCount2on1 === "number" && Number.isFinite(body.sessionCount2on1)
      ? body.sessionCount2on1
      : NaN;
  const referralEntries =
    body?.referralEntries === undefined ? [] : parseReferralEntries(body.referralEntries);
  const referralPaymentAmount = (referralEntries ?? []).reduce((sum, e) => sum + e.amount, 0);
  const allocationOrder =
    typeof body?.allocationOrder === "string" &&
    VALID_ALLOCATION_ORDERS.includes(body.allocationOrder as AllocationOrder)
      ? (body.allocationOrder as AllocationOrder)
      : undefined;
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId) ? body.coachId : null;

  if (
    !employeeName ||
    !isValidMonthKey(yearMonth) ||
    !employmentType ||
    Number.isNaN(sessionCount1on1) ||
    Number.isNaN(sessionCount2on1) ||
    sessionCount1on1 < 0 ||
    sessionCount2on1 < 0 ||
    referralEntries === null
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 클라이언트가 보낸 결과 숫자는 신뢰하지 않고, 서버에서 동일한 순수 함수로
  // 다시 계산해 저장한다(화면 표시용 미리보기와 저장값이 항상 같은 로직을 타게 함).
  const result = calculatePayroll({
    employmentType,
    hiredAt,
    yearMonth,
    isTeamLead,
    sessionCount1on1,
    sessionCount2on1,
    referralPaymentAmount,
    allocationOrder,
  });

  const record = await savePayrollRecord({
    coachId,
    employeeName,
    yearMonth,
    employmentType,
    hiredAt,
    isTeamLead,
    sessionCount1on1,
    sessionCount2on1,
    referralPaymentAmount,
    referralEntries,
    result,
  });

  return NextResponse.json({ record });
}
