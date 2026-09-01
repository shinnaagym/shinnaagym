import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { getInsuranceRates, saveInsuranceRates, type InsuranceRates } from "@/lib/payroll";

async function requirePayrollAccess() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isPayrollAuthed())) {
    return NextResponse.json({ error: "급여 계산 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const rates = await getInsuranceRates();
  return NextResponse.json({ rates });
}

function parseRateField(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

export async function PUT(req: NextRequest) {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const nationalPensionRate = parseRateField(body?.nationalPensionRate);
  const healthInsuranceRate = parseRateField(body?.healthInsuranceRate);
  const longTermCareRateOfHealthInsurance = parseRateField(body?.longTermCareRateOfHealthInsurance);
  const employmentInsuranceRate = parseRateField(body?.employmentInsuranceRate);
  const nationalPensionCap =
    typeof body?.nationalPensionCap === "number" &&
    Number.isFinite(body.nationalPensionCap) &&
    body.nationalPensionCap > 0
      ? Math.round(body.nationalPensionCap)
      : null;

  if (
    nationalPensionRate === null ||
    healthInsuranceRate === null ||
    longTermCareRateOfHealthInsurance === null ||
    employmentInsuranceRate === null ||
    nationalPensionCap === null
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rates: InsuranceRates = {
    nationalPensionRate,
    nationalPensionCap,
    healthInsuranceRate,
    longTermCareRateOfHealthInsurance,
    employmentInsuranceRate,
  };
  await saveInsuranceRates(rates);
  return NextResponse.json({ rates });
}
