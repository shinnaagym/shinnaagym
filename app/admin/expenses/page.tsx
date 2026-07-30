import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey, koreaCurrentMonthKey } from "@/lib/date";
import { getPaymentTotalsForMonth, listExpensesByMonth } from "@/lib/expenses";
import { ExpensesView } from "./expenses-view";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { month } = await searchParams;
  const monthKey = month && isValidMonthKey(month) ? month : koreaCurrentMonthKey();

  const [expenses, paymentTotals] = await Promise.all([
    listExpensesByMonth(monthKey),
    getPaymentTotalsForMonth(monthKey),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Ledger</p>
      <h1 className="font-display text-2xl mb-1">가계부</h1>
      <p className="text-sm text-ink/50 mb-6">월별 지출 내역을 기록하고 합계를 확인하세요.</p>
      <ExpensesView monthKey={monthKey} expenses={expenses} paymentTotals={paymentTotals} />
    </div>
  );
}
