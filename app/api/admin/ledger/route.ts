import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { getPaymentTotalsForMonth, listExpensesByMonth } from "@/lib/expenses";

/** 가계부 화면(지출 내역 + 결제 내역)의 잠금 해제 이후 데이터 조회용. 월별
    지출/결제 데이터는 민감 정보라 관리자 인증에 더해 가계부 2차 비밀번호
    세션도 함께 확인한다. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }
  const [expenses, paymentTotals] = await Promise.all([
    listExpensesByMonth(month),
    getPaymentTotalsForMonth(month),
  ]);
  return NextResponse.json({ expenses, paymentTotals });
}
