import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import {
  getMonthlyDeposits,
  getReserveBalances,
  listReserveTransactions,
  runMonthlySettlement,
} from "@/lib/reserves";

async function requireLedgerAuth() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

/** 저수지 대시보드 조회 — 저수지별 누적 잔액, 이번 달 적립액, 최근 거래 내역. */
export async function GET(req: NextRequest) {
  const authError = await requireLedgerAuth();
  if (authError) return authError;

  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }

  const [balances, monthlyDeposits, transactions] = await Promise.all([
    getReserveBalances(),
    getMonthlyDeposits(month),
    listReserveTransactions(),
  ]);
  return NextResponse.json({ balances, monthlyDeposits, transactions });
}

/** "이번 달 정산" 버튼 — 그 달 매출·지출·급여·잔여 세션 가치를 기준으로
    7개 저수지의 당월 적립액을 재계산해 저장한다(멱등, 여러 번 눌러도 안전). */
export async function POST(req: NextRequest) {
  const authError = await requireLedgerAuth();
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as { month?: unknown } | null;
  const month = typeof body?.month === "string" ? body.month : "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }

  const settlement = await runMonthlySettlement(month);
  const [balances, monthlyDeposits] = await Promise.all([
    getReserveBalances(),
    getMonthlyDeposits(month),
  ]);
  return NextResponse.json({ settlement, balances, monthlyDeposits });
}
