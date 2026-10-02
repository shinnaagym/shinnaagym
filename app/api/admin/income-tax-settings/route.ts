import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { getIncomeTaxSettings, saveIncomeTaxSettings, type IncomeTaxSettings } from "@/lib/income-tax";

async function requireLedgerAuth() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

/** 종합소득세 예비비 계산에 쓰는 필요경비 설정값 조회. */
export async function GET() {
  const authError = await requireLedgerAuth();
  if (authError) return authError;

  const settings = await getIncomeTaxSettings();
  return NextResponse.json({ settings });
}

function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** 월세·관리비·장비소모품·마케팅비·카드 수수료율·월 소득공제 저장. */
export async function PATCH(req: NextRequest) {
  const authError = await requireLedgerAuth();
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as Partial<IncomeTaxSettings> | null;
  const monthlyRent = body?.monthlyRent;
  const monthlyUtilities = body?.monthlyUtilities;
  const monthlySupplies = body?.monthlySupplies;
  const monthlyMarketing = body?.monthlyMarketing;
  const cardFeeRate = body?.cardFeeRate;
  const monthlyIncomeDeduction = body?.monthlyIncomeDeduction;

  if (
    !isNonNegativeNumber(monthlyRent) ||
    !isNonNegativeNumber(monthlyUtilities) ||
    !isNonNegativeNumber(monthlySupplies) ||
    !isNonNegativeNumber(monthlyMarketing) ||
    !isNonNegativeNumber(cardFeeRate) ||
    cardFeeRate > 1 ||
    !isNonNegativeNumber(monthlyIncomeDeduction)
  ) {
    return NextResponse.json({ error: "값을 다시 확인해주세요." }, { status: 400 });
  }

  const settings = await saveIncomeTaxSettings({
    monthlyRent: Math.round(monthlyRent),
    monthlyUtilities: Math.round(monthlyUtilities),
    monthlySupplies: Math.round(monthlySupplies),
    monthlyMarketing: Math.round(monthlyMarketing),
    cardFeeRate,
    monthlyIncomeDeduction: Math.round(monthlyIncomeDeduction),
  });
  return NextResponse.json({ settings });
}
