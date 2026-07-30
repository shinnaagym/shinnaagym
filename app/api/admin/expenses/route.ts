import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { createExpense, listExpensesByMonth } from "@/lib/expenses";
import { recordUndo } from "@/lib/undo";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }
  const expenses = await listExpensesByMonth(month);
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        yearMonth?: unknown;
        item?: unknown;
        amount?: unknown;
        quantity?: unknown;
        note?: unknown;
      }
    | null;
  const yearMonth = typeof body?.yearMonth === "string" ? body.yearMonth : "";
  const item = typeof body?.item === "string" ? body.item.trim() : "";
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const quantity =
    typeof body?.quantity === "number" ? body.quantity : Number(body?.quantity) || 1;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (!isValidMonthKey(yearMonth)) {
    return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
  }
  if (!item) {
    return NextResponse.json({ error: "지출 내역을 입력해주세요." }, { status: 400 });
  }
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: "금액을 입력해주세요." }, { status: 400 });
  }

  const expense = await createExpense({
    yearMonth,
    item,
    amount,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    note,
  });
  await recordUndo(`"${item}" 지출 추가`, [{ op: "delete", table: "expenses", id: expense.id }]);
  return NextResponse.json({ expense }, { status: 201 });
}
