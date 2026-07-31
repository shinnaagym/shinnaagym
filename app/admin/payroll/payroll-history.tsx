"use client";

import { Fragment, useEffect, useState } from "react";
import type { CoachRow, EmploymentType, PayrollRecordRow } from "@/lib/db";
import type { ReferralEntry } from "@/lib/payroll";
import type { PayrollResult } from "@/lib/payroll/calculate";
import { MandatoryGauge, PayComposition, PayrollSpecCard } from "./payroll-result";

function formatWon(n: number): string {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: "정직원",
  freelancer: "프리랜서",
  team_lead: "팀장",
  owner: "대표",
};

function PayrollRecordDetail({ record }: { record: PayrollRecordRow }) {
  const result = record.result as PayrollResult;
  const referralEntries = (record.referral_entries as ReferralEntry[] | null) ?? [];
  return (
    <div className="space-y-3 px-1 py-3">
      <PayrollSpecCard
        employeeName={record.employee_name}
        yearMonth={record.year_month}
        result={result}
        referralEntries={referralEntries}
      />
      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-3">의무수업 진행 현황</h3>
        <MandatoryGauge result={result} />
      </div>
      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-3">지급 항목 구성</h3>
        <PayComposition result={result} />
      </div>
    </div>
  );
}

export function PayrollHistory({ coaches }: { coaches: CoachRow[] }) {
  const [yearMonth, setYearMonth] = useState("");
  const [coachId, setCoachId] = useState("");
  const [records, setRecords] = useState<PayrollRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRecords() {
      const params = new URLSearchParams();
      if (yearMonth) params.set("yearMonth", yearMonth);
      if (coachId) params.set("coachId", coachId);
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/payroll?${params.toString()}`);
        const data = res.ok ? await res.json() : { records: [] };
        if (!cancelled) setRecords(data.records ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRecords();
    return () => {
      cancelled = true;
    };
  }, [yearMonth, coachId]);

  async function handleDelete(id: number) {
    if (!window.confirm("이 급여 이력을 삭제할까요?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/payroll/${id}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert("삭제에 실패했어요.");
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpanded(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
        />
        <select
          value={coachId}
          onChange={(e) => setCoachId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
        >
          <option value="">전체 직원</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(yearMonth || coachId) && (
          <button
            type="button"
            onClick={() => {
              setYearMonth("");
              setCoachId("");
            }}
            className="text-xs text-ink/50 hover:underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink/40 py-8 text-center">불러오는 중…</p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 px-5 py-8 text-center text-ink/40 text-sm">
          저장된 급여 이력이 없어요.
        </div>
      ) : (
        <>
          <p className="text-xs text-ink/40 mb-2 sm:hidden">항목을 눌러 자세히 볼 수 있어요.</p>
          {/* 좁은 화면에서는 표 대신 항목별 카드로 쌓아 열이 서로 겹치지 않게 한다. */}
          <div className="sm:hidden space-y-2">
            {records.map((r) => (
              <div key={r.id}>
                <div
                  onClick={() => toggleExpanded(r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(r.id);
                    }
                  }}
                  className="w-full text-left rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3 text-sm hover:border-coral/40 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-medium">
                      {r.employee_name}{" "}
                      <span className="text-xs text-ink/40 font-normal">
                        {EMPLOYMENT_TYPE_LABEL[r.employment_type]} · {r.year_month}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                      disabled={deletingId === r.id}
                      className="text-xs text-coral hover:opacity-70 disabled:opacity-50 whitespace-nowrap"
                    >
                      {deletingId === r.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-ink/60">
                    <span>근속</span>
                    <span>{(r.result as PayrollResult)?.tenureLabel ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-ink/60">
                    <span>총지급액</span>
                    <span>{formatWon((r.result as PayrollResult)?.grossPay ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium">
                    <span>실지급액</span>
                    <span>{formatWon((r.result as PayrollResult)?.netPay ?? 0)}</span>
                  </div>
                  <p className="text-xs text-ink/40 mt-1.5">
                    {new Date(r.created_at).toLocaleString("ko-KR")} 저장
                  </p>
                </div>
                {expandedId === r.id && <PayrollRecordDetail record={r} />}
              </div>
            ))}
          </div>

          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-4 py-2.5 font-medium">정산월</th>
                  <th className="px-4 py-2.5 font-medium">이름</th>
                  <th className="px-4 py-2.5 font-medium">고용형태</th>
                  <th className="px-4 py-2.5 font-medium">근속</th>
                  <th className="px-4 py-2.5 font-medium text-right">총지급액</th>
                  <th className="px-4 py-2.5 font-medium text-right">실지급액</th>
                  <th className="px-4 py-2.5 font-medium">저장일시</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const result = r.result as PayrollResult;
                  const isExpanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => toggleExpanded(r.id)}
                        className="border-b border-line/40 last:border-0 cursor-pointer hover:bg-bone/40 transition"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">{r.year_month}</td>
                        <td className="px-4 py-2.5">{r.employee_name}</td>
                        <td className="px-4 py-2.5">
                          {EMPLOYMENT_TYPE_LABEL[r.employment_type]}
                        </td>
                        <td className="px-4 py-2.5">{result?.tenureLabel ?? "-"}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {formatWon(result?.grossPay ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                          {formatWon(result?.netPay ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-ink/50 text-xs">
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(r.id);
                            }}
                            disabled={deletingId === r.id}
                            className="text-xs text-coral hover:opacity-70 disabled:opacity-50 whitespace-nowrap"
                          >
                            {deletingId === r.id ? "삭제 중..." : "삭제"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-line/40 last:border-0">
                          <td colSpan={8} className="bg-bone/20 px-4">
                            <PayrollRecordDetail record={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
