import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { setTaxableIncomeOverride } from "@/lib/income-tax";

async function requireLedgerAuth() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

/** 그 달 과세표준을 직접 입력(덮어쓰기)하거나, taxableIncome을 null로 보내 지워서
    다시 자동 계산값을 쓰게 한다. */
export async function PUT(req: NextRequest) {
  const authError = await requireLedgerAuth();
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as
    | { month?: unknown; taxableIncome?: unknown }
    | null;
  const month = typeof body?.month === "string" ? body.month : "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }

  if (body?.taxableIncome === null) {
    await setTaxableIncomeOverride(month, null);
    return NextResponse.json({ ok: true });
  }

  const taxableIncome = Number(body?.taxableIncome);
  if (!Number.isFinite(taxableIncome)) {
    return NextResponse.json({ error: "과세표준 값을 올바르게 입력해주세요." }, { status: 400 });
  }

  await setTaxableIncomeOverride(month, Math.round(taxableIncome));
  return NextResponse.json({ ok: true });
}
