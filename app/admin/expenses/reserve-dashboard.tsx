"use client";

import { useEffect, useState } from "react";
import { RESERVE_TYPE_LABELS, RESERVE_TYPE_OPTIONS, type ReserveType } from "@/lib/constants";
import type { ReserveTransactionRow } from "@/lib/db";
import type { MonthlySettlementResult } from "@/lib/reserves";

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

type ReserveMap = Record<ReserveType, number>;

/** 저수지(세금·예비비) 관리 대시보드. 저수지별 "이번 달 적립액"과 "누적
    잔액"을 함께 보여주고, "이번 달 정산" 버튼으로 매출·지출·급여 기준
    자동 적립을 실행하며, 세금 납부/비용 지출 시 각 저수지에서 직접
    차감(납부) 처리할 수 있다. */
export function ReserveDashboard({ monthKey }: { monthKey: string }) {
  const [balances, setBalances] = useState<ReserveMap | null>(null);
  const [monthlyDeposits, setMonthlyDeposits] = useState<ReserveMap | null>(null);
  const [transactions, setTransactions] = useState<ReserveTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [lastSettlement, setLastSettlement] = useState<MonthlySettlementResult | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ReserveType | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMemo, setWithdrawMemo] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadReserves(month: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reserves?month=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저수지 정보를 불러오지 못했어요.");
      setBalances(data.balances);
      setMonthlyDeposits(data.monthlyDeposits);
      setTransactions(data.transactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저수지 정보를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadReserves(monthKey);
    })();
  }, [monthKey]);

  async function runSettlement() {
    setSettling(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reserves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "정산에 실패했어요.");
      setLastSettlement(data.settlement);
      await loadReserves(monthKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "정산에 실패했어요.");
    } finally {
      setSettling(false);
    }
  }

  function openWithdraw(type: ReserveType) {
    setWithdrawTarget(withdrawTarget === type ? null : type);
    setWithdrawAmount("");
    setWithdrawMemo("");
  }

  async function submitWithdraw(type: ReserveType) {
    const amountNum = Number(withdrawAmount);
    if (!withdrawAmount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError("차감할 금액을 입력해주세요.");
      return;
    }
    setSubmittingWithdraw(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reserves/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserveType: type,
          amount: amountNum,
          yearMonth: monthKey,
          memo: withdrawMemo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "차감에 실패했어요.");
      setBalances(data.balances);
      setTransactions((prev) => [data.entry, ...prev]);
      setWithdrawTarget(null);
      setWithdrawAmount("");
      setWithdrawMemo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "차감에 실패했어요.");
    } finally {
      setSubmittingWithdraw(false);
    }
  }

  function startEdit(t: ReserveTransactionRow) {
    setEditingId(t.id);
    setEditAmount(String(t.amount));
    setEditMemo(t.memo);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    const amountNum = Number(editAmount);
    if (!editAmount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError("금액을 입력해주세요.");
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reserves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, memo: editMemo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정에 실패했어요.");
      setBalances(data.balances);
      setTransactions((prev) => prev.map((t) => (t.id === id ? data.entry : t)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정에 실패했어요.");
    } finally {
      setSavingEdit(false);
    }
  }

  const totalBalance = balances
    ? Object.values(balances).reduce((sum, v) => sum + v, 0)
    : null;

  return (
    <div className="rounded-2xl bg-white border border-line/60 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="font-display text-lg">저수지 관리</h2>
        <button
          type="button"
          onClick={runSettlement}
          disabled={settling || loading}
          className="rounded-full bg-ink text-white px-4 py-1.5 text-sm hover:bg-coral transition disabled:opacity-50"
        >
          {settling ? "정산 중..." : `${formatMonthLabel(monthKey)} 정산`}
        </button>
      </div>
      <p className="text-xs text-ink/50 mb-4">
        매출·지출·급여를 기준으로 세금·예비비를 자동으로 쌓고, 실제 납부·지출 시 각 저수지에서
        차감하세요. &quot;{formatMonthLabel(monthKey)} 정산&quot;은 몇 번을 눌러도 그 달 자동
        적립액을 새로 계산해 덮어쓸 뿐, 직접 기록한 적립·차감은 건드리지 않아요.
      </p>

      {totalBalance !== null && (
        <div className="rounded-xl bg-ink text-white px-5 py-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-white/70">저수지 전체 누적 잔액</span>
          <span className="text-xl font-semibold">{formatWon(totalBalance)}</span>
        </div>
      )}

      {error && <p className="text-sm text-coral mb-3">{error}</p>}

      {lastSettlement && (
        <div className="rounded-xl bg-sage/10 border border-sage/30 px-4 py-3 mb-4 text-xs text-ink/70 space-y-1">
          <p className="font-medium text-ink">
            {formatMonthLabel(lastSettlement.yearMonth)} 정산 결과
          </p>
          <p>
            매출 {formatWon(lastSettlement.revenue)} · 지출 {formatWon(lastSettlement.expenseTotal)} ·
            순이익 {formatWon(lastSettlement.netProfit)}
          </p>
          <p>
            정직원 급여 합계 {formatWon(lastSettlement.regularPayrollGross)} · 잔여 세션 가치{" "}
            {formatWon(lastSettlement.remainingSessionValue)}
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink/40 py-6 text-center">불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {RESERVE_TYPE_OPTIONS.map((option) => {
            const monthly = monthlyDeposits?.[option.value] ?? 0;
            const balance = balances?.[option.value] ?? 0;
            const isOpen = withdrawTarget === option.value;
            return (
              <div
                key={option.value}
                className="rounded-xl border border-line/60 bg-bone/20 p-4 flex flex-col gap-2"
              >
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-[11px] text-ink/40">{option.rateDescription}</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink/50">이번 달 적립</span>
                  <span className="text-sm font-medium">{formatWon(monthly)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-line/50 pt-2">
                  <span className="text-[11px] text-ink/50">누적 잔액</span>
                  <span className="text-lg font-semibold text-coral">{formatWon(balance)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openWithdraw(option.value)}
                  className="mt-1 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-white transition"
                >
                  {isOpen ? "닫기" : "납부·차감 기록"}
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1.5 rounded-lg bg-white border border-line/50 p-2.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="차감 금액"
                      className="w-full rounded-md border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                    />
                    <input
                      value={withdrawMemo}
                      onChange={(e) => setWithdrawMemo(e.target.value)}
                      placeholder="메모 (예: 7월 부가가치세 신고 납부)"
                      className="w-full rounded-md border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                    />
                    <button
                      type="button"
                      onClick={() => submitWithdraw(option.value)}
                      disabled={submittingWithdraw}
                      className="w-full rounded-md bg-coral text-white px-2 py-1.5 text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                      {submittingWithdraw ? "처리 중..." : "차감 확정"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-ink/60 mb-2">최근 적립·차감 내역</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="text-left text-ink/40 border-b border-line/50">
                  <th className="py-1.5 pr-2 font-medium">날짜</th>
                  <th className="px-2 py-1.5 font-medium">저수지</th>
                  <th className="px-2 py-1.5 font-medium">구분</th>
                  <th className="px-2 py-1.5 font-medium text-right">금액</th>
                  <th className="px-2 py-1.5 font-medium">메모</th>
                  <th className="px-2 py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {transactions.slice(0, 15).map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <tr key={t.id}>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-ink/50">
                        {formatDateTime(t.created_at)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {RESERVE_TYPE_LABELS[t.reserve_type] ?? t.reserve_type}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span
                          className={
                            t.transaction_type === "withdrawal"
                              ? "rounded-full bg-red-50 text-red-500 px-2 py-0.5"
                              : "rounded-full bg-sage/10 text-sage px-2 py-0.5"
                          }
                        >
                          {t.transaction_type === "withdrawal" ? "차감" : "적립"}
                        </span>
                      </td>
                      {isEditing ? (
                        <>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-24 rounded-md border border-line px-2 py-1 text-xs text-right outline-none focus:border-coral"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={editMemo}
                              onChange={(e) => setEditMemo(e.target.value)}
                              className="w-full min-w-[120px] rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => saveEdit(t.id)}
                              disabled={savingEdit}
                              className="text-coral hover:opacity-70 disabled:opacity-50 mr-2"
                            >
                              {savingEdit ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-ink/40 hover:text-ink"
                            >
                              취소
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium">
                            {t.transaction_type === "withdrawal" ? "-" : "+"}
                            {formatWon(t.amount)}
                          </td>
                          <td className="px-2 py-1.5 text-ink/60">{t.memo}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="text-ink/40 hover:text-coral"
                            >
                              수정
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
