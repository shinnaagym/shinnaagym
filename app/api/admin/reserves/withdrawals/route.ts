import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { RESERVE_TYPE_OPTIONS, type ReserveType } from "@/lib/constants";
import { addReserveWithdrawal, getReserveBalances } from "@/lib/reserves";

const VALID_RESERVE_TYPES = new Set(RESERVE_TYPE_OPTIONS.map((o) => o.value));

/** 대표가 세금을 납부하거나 비용을 지출했을 때, 해당 저수지의 누적 잔액에서
    차감한다(예: 7월 부가가치세 신고 후 300만 원 납부 → 부가가치세 저수지에서
    300만 원 차감). */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { reserveType?: unknown; amount?: unknown; yearMonth?: unknown; memo?: unknown }
    | null;
  const reserveType =
    typeof body?.reserveType === "string" && VALID_RESERVE_TYPES.has(body.reserveType as ReserveType)
      ? (body.reserveType as ReserveType)
      : null;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const yearMonth = typeof body?.yearMonth === "string" ? body.yearMonth : "";
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";

  if (!reserveType) {
    return NextResponse.json({ error: "잘못된 저수지 종류입니다." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "차감할 금액을 입력해주세요." }, { status: 400 });
  }
  if (!isValidMonthKey(yearMonth)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }

  const entry = await addReserveWithdrawal(reserveType, Math.round(amount), yearMonth, memo);
  const balances = await getReserveBalances();
  return NextResponse.json({ entry, balances });
}
