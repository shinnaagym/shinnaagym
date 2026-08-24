import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isLedgerAuthed } from "@/lib/auth";
import { getReserveBalances, updateReserveTransaction } from "@/lib/reserves";

/** 최근 적립·차감 내역 표에서 잘못 기록한 금액·메모를 바로잡는다. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isLedgerAuthed())) {
    return NextResponse.json({ error: "가계부 비밀번호 확인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { amount?: unknown; memo?: unknown }
    | null;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "금액을 입력해주세요." }, { status: 400 });
  }

  const entry = await updateReserveTransaction(idNum, Math.round(amount), memo);
  if (!entry) {
    return NextResponse.json({ error: "존재하지 않는 항목입니다." }, { status: 404 });
  }
  const balances = await getReserveBalances();
  return NextResponse.json({ entry, balances });
}
