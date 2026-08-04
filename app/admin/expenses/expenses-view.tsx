"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseRow } from "@/lib/db";
import { ExpenseMonthPicker } from "./expense-month-picker";

function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

const AMOUNT_QUICK_ADD = [
  { label: "+1천", value: 1000 },
  { label: "+1만", value: 10000 },
  { label: "+10만", value: 100000 },
  { label: "+100만", value: 1000000 },
];

export function ExpensesView({
  monthKey,
  expenses,
  paymentTotals,
}: {
  monthKey: string;
  expenses: ExpenseRow[];
  paymentTotals: { card: number; transfer: number };
}) {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = expenses.reduce((sum, e) => sum + e.amount * e.quantity, 0);

  function goToMonth(key: string) {
    router.push(`/admin/expenses?month=${key}`);
  }

  async function handleAdd() {
    const trimmedItem = item.trim();
    const amountNum = Number(amount);
    const quantityNum = Number(quantity) || 1;
    if (!trimmedItem) {
      setError("지출 내역을 입력해주세요.");
      return;
    }
    if (!amount || Number.isNaN(amountNum)) {
      setError("금액을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: monthKey,
          item: trimmedItem,
          amount: amountNum,
          quantity: quantityNum,
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "추가에 실패했어요.");
        return;
      }
      setItem("");
      setAmount("");
      setQuantity("1");
      setNote("");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("이 지출 항목을 삭제할까요?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert("삭제에 실패했어요.");
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px] items-start">
      <div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => goToMonth(addMonthsToMonthKey(monthKey, -1))}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
          >
            ‹ 이전 달
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/expenses")}
            className="rounded-full bg-ink text-white px-4 py-1.5 text-sm hover:bg-coral transition"
          >
            이번 달
          </button>
          <button
            type="button"
            onClick={() => goToMonth(addMonthsToMonthKey(monthKey, 1))}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
          >
            다음 달 ›
          </button>
          <p className="font-display text-lg ml-2">{formatMonthLabel(monthKey)}</p>
        </div>

        <div className="mb-6">
          <ExpenseMonthPicker monthKey={monthKey} />
        </div>

        <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 mb-6">
          <h2 className="font-display text-base mb-3">+ 지출 추가</h2>
          <div className="grid grid-cols-2 sm:grid-cols-[2fr_1.2fr_72px_1fr] gap-2">
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="지출 내역"
              className="col-span-2 sm:col-span-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <div>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <div className="flex gap-1 mt-1">
                {AMOUNT_QUICK_ADD.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setAmount(String((Number(amount) || 0) + q.value))}
                    className="flex-1 whitespace-nowrap rounded-md border border-line bg-white px-1 py-1 text-[11px] text-ink/60 hover:bg-bone transition"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="수량"
              className="w-full min-w-0 rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none focus:border-coral"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="내용 (선택)"
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting}
            className="mt-3 w-full sm:w-auto rounded-lg bg-coral text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? "추가 중..." : "추가"}
          </button>
          {error && <p className="text-xs text-coral mt-2">{error}</p>}
        </div>

        {expenses.length === 0 ? (
          <div className="rounded-2xl bg-white border border-line/60 px-5 py-8 text-center text-ink/40 text-sm">
            이번 달 지출 내역이 없어요.
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">지출 내역</th>
                  <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">금액</th>
                  <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">수량</th>
                  <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">소계</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">내용</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-line/40 last:border-0">
                    <td className="px-4 py-2.5">{e.item}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {formatWon(e.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{e.quantity}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                      {formatWon(e.amount * e.quantity)}
                    </td>
                    <td className="px-4 py-2.5 text-ink/60">{e.note}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        disabled={deletingId === e.id}
                        className="text-xs text-coral hover:opacity-70 disabled:opacity-50 whitespace-nowrap"
                      >
                        {deletingId === e.id ? "삭제 중..." : "삭제"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-medium">
                    합계
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    {formatWon(total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
        <p className="font-display text-base mb-3">{formatMonthLabel(monthKey)} 결제 내역</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink/60">카드결제</span>
            <span className="font-medium">{formatWon(paymentTotals.card)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink/60">계좌이체</span>
            <span className="font-medium">{formatWon(paymentTotals.transfer)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-line/60">
            <span className="text-ink/60">합계</span>
            <span className="font-semibold">
              {formatWon(paymentTotals.card + paymentTotals.transfer)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
