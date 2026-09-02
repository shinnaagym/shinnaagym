"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoachRow, EmploymentType } from "@/lib/db";
import type { InsuranceRates } from "@/lib/payroll";
import {
  calculatePayroll,
  computeReferralSupplyAmount,
  type AllocationOrder,
  type PayrollInput,
  type ReferralPaymentMethod,
} from "@/lib/payroll/calculate";
import { PrintButton } from "@/app/components/PrintButton";
import { PayrollResultCards } from "./payroll-result";
import { PayrollHistory } from "./payroll-history";
import { PayrollInsuranceSettings } from "./payroll-insurance-settings";

const TENURE_BUCKETS = ["under1", "1to2", "over2"] as const;

const ALLOCATION_OPTIONS: Array<{ value: AllocationOrder; label: string }> = [
  { value: "proportional", label: "진행 비율 안분" },
  { value: "1on1-first", label: "낮은 단가(1:1)부터 차감" },
  { value: "2on1-first", label: "높은 단가(2:1)부터 차감" },
];

const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: "정직원",
  freelancer: "프리랜서",
  team_lead: "팀장",
  owner: "대표",
};

const REFERRAL_PAYMENT_METHOD_LABEL: Record<ReferralPaymentMethod, string> = {
  card: "카드결제(부가세 포함)",
  transfer: "계좌이체(부가세 제외)",
};

export function PayrollView({
  coaches,
  defaultYearMonth,
  initialInsuranceRates,
}: {
  coaches: CoachRow[];
  defaultYearMonth: string;
  initialInsuranceRates: InsuranceRates;
}) {
  const [tab, setTab] = useState<"calc" | "history" | "rates">("calc");
  const [insuranceRates, setInsuranceRates] = useState<InsuranceRates>(initialInsuranceRates);

  const [coachSelection, setCoachSelection] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("regular");
  const [hiredAt, setHiredAt] = useState("");
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [sessionCount1on1, setSessionCount1on1] = useState("0");
  const [sessionCount2on1, setSessionCount2on1] = useState("0");
  const [referralEntries, setReferralEntries] = useState<
    Array<{ note: string; amount: string; paymentMethod: ReferralPaymentMethod }>
  >([{ note: "", amount: "", paymentMethod: "card" }]);
  const [allocationOrder, setAllocationOrder] = useState<AllocationOrder>("proportional");
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 직원별로 신고해둔 4대보험 산정 기준 보수월액. coaches prop을 초기값으로
  // 시작해, 저장에 성공하면 그 결과로만 갱신한다(서버 재조회 없이 화면에
  // 바로 반영하기 위함).
  const [savedDeclaredComp, setSavedDeclaredComp] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(coaches.map((c) => [c.id, c.declared_monthly_compensation])),
  );
  const [declaredMonthlyCompensation, setDeclaredMonthlyCompensation] = useState("");
  const [savingDeclaredComp, setSavingDeclaredComp] = useState(false);
  const [declaredCompMessage, setDeclaredCompMessage] = useState<string | null>(null);

  const selectedCoach = useMemo(
    () =>
      coachSelection && coachSelection !== "manual"
        ? coaches.find((c) => c.id === Number(coachSelection)) ?? null
        : null,
    [coachSelection, coaches],
  );

  // 코치를 바꾸면 등록해둔 고용정보를 자동으로 불러온다(직접 수정 가능). 렌더링
  // 도중 선택이 바뀐 걸 감지해 상태를 조정하는 패턴이라 useEffect를 쓰지 않는다.
  const [appliedCoachSelection, setAppliedCoachSelection] = useState(coachSelection);
  if (coachSelection !== appliedCoachSelection) {
    setAppliedCoachSelection(coachSelection);
    if (selectedCoach) {
      setEmploymentType(selectedCoach.employment_type);
      setHiredAt(selectedCoach.hired_at);
      setIsTeamLead(selectedCoach.is_team_lead);
      const saved = savedDeclaredComp[selectedCoach.id];
      setDeclaredMonthlyCompensation(saved != null ? String(saved) : "");
      setDeclaredCompMessage(null);
    }
  }

  // 코치+정산월이 정해지면 그 달 진행 수업 횟수를 자동으로 불러온다(수동 보정 가능).
  useEffect(() => {
    if (!selectedCoach || !yearMonth) return;
    const coachId = selectedCoach.id;
    let cancelled = false;
    async function loadSessionCounts() {
      setLoadingCounts(true);
      try {
        const res = await fetch(
          `/api/admin/payroll/session-counts?coachId=${coachId}&yearMonth=${yearMonth}`,
        );
        const data = res.ok ? await res.json() : null;
        if (cancelled || !data) return;
        setSessionCount1on1(String(data.sessionCount1on1 ?? 0));
        setSessionCount2on1(String(data.sessionCount2on1 ?? 0));
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    }
    void loadSessionCounts();
    return () => {
      cancelled = true;
    };
  }, [selectedCoach, yearMonth]);

  const employeeName =
    coachSelection === "manual" ? manualName.trim() : (selectedCoach?.name ?? "");

  function addReferralEntry() {
    setReferralEntries((prev) => [...prev, { note: "", amount: "", paymentMethod: "card" }]);
  }

  function updateReferralEntry(
    index: number,
    patch: Partial<{ note: string; amount: string; paymentMethod: ReferralPaymentMethod }>,
  ) {
    setReferralEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeReferralEntry(index: number) {
    setReferralEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const referralRawTotal = referralEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const referralSupplyAmount = computeReferralSupplyAmount(
    referralEntries.map((e) => ({
      note: e.note,
      amount: Number(e.amount) || 0,
      paymentMethod: e.paymentMethod,
    })),
  );

  const declaredMonthlyCompensationValue = declaredMonthlyCompensation.trim()
    ? Number(declaredMonthlyCompensation) || null
    : null;

  const baseInput: PayrollInput = useMemo(
    () => ({
      employmentType,
      hiredAt,
      yearMonth,
      isTeamLead,
      sessionCount1on1: Number(sessionCount1on1) || 0,
      sessionCount2on1: Number(sessionCount2on1) || 0,
      referralSupplyAmount,
      allocationOrder,
      insuranceRates,
      declaredMonthlyCompensation: declaredMonthlyCompensationValue,
    }),
    [
      employmentType,
      hiredAt,
      yearMonth,
      isTeamLead,
      sessionCount1on1,
      sessionCount2on1,
      referralSupplyAmount,
      allocationOrder,
      insuranceRates,
      declaredMonthlyCompensationValue,
    ],
  );

  async function handleSaveDeclaredComp() {
    if (!selectedCoach) return;
    const trimmed = declaredMonthlyCompensation.trim();
    if (trimmed && (!Number.isFinite(Number(trimmed)) || Number(trimmed) <= 0)) {
      setDeclaredCompMessage("보수월액은 0보다 큰 숫자여야 해요.");
      return;
    }
    const amount = trimmed ? Number(trimmed) : null;
    setSavingDeclaredComp(true);
    setDeclaredCompMessage(null);
    try {
      const res = await fetch(`/api/admin/payroll/coaches/${selectedCoach.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declaredMonthlyCompensation: amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeclaredCompMessage(data.error ?? "저장에 실패했어요.");
        return;
      }
      setSavedDeclaredComp((prev) => ({ ...prev, [selectedCoach.id]: amount }));
      setDeclaredCompMessage(amount ? "저장했어요." : "삭제했어요. 당월 급여 기준으로 계산돼요.");
    } catch {
      setDeclaredCompMessage("네트워크 오류가 발생했어요.");
    } finally {
      setSavingDeclaredComp(false);
    }
  }

  const result = useMemo(() => calculatePayroll(baseInput), [baseInput]);

  const comparisonEmploymentType: EmploymentType =
    employmentType === "regular" ? "freelancer" : "regular";
  const comparisonResult = useMemo(
    () => calculatePayroll({ ...baseInput, employmentType: comparisonEmploymentType }),
    [baseInput, comparisonEmploymentType],
  );

  const tenureSimulations = useMemo(
    () =>
      TENURE_BUCKETS.map((bucket) =>
        calculatePayroll({ ...baseInput, tenureBucketOverride: bucket }),
      ),
    [baseInput],
  );

  async function handleSave() {
    if (!employeeName) {
      setError("직원을 선택하거나 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: selectedCoach?.id ?? null,
          employeeName,
          ...baseInput,
          referralEntries: referralEntries
            .filter((e) => e.note.trim() || Number(e.amount) > 0)
            .map((e) => ({
              note: e.note.trim(),
              amount: Number(e.amount) || 0,
              paymentMethod: e.paymentMethod,
            })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      setSaveMessage("저장했어요. '월별 이력'에서 확인할 수 있어요.");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="no-print flex items-center gap-1 rounded-full bg-bone/70 p-1 mb-6 w-fit">
        <button
          type="button"
          onClick={() => setTab("calc")}
          className={[
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "calc" ? "bg-coral text-white shadow-sm" : "text-ink/60 hover:text-ink",
          ].join(" ")}
        >
          급여 계산
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={[
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "history" ? "bg-coral text-white shadow-sm" : "text-ink/60 hover:text-ink",
          ].join(" ")}
        >
          월별 이력
        </button>
        <button
          type="button"
          onClick={() => setTab("rates")}
          className={[
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "rates" ? "bg-coral text-white shadow-sm" : "text-ink/60 hover:text-ink",
          ].join(" ")}
        >
          요율 설정
        </button>
      </div>

      {tab === "history" ? (
        <PayrollHistory coaches={coaches} />
      ) : tab === "rates" ? (
        <PayrollInsuranceSettings rates={insuranceRates} onSaved={setInsuranceRates} />
      ) : (
        <div className="space-y-6">
          <div className="no-print rounded-2xl border border-line/60 bg-white shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs text-ink/50 mb-1">직원</label>
              <div className="flex flex-wrap gap-2">
                {coaches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoachSelection(String(c.id))}
                    className={[
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
                      coachSelection === String(c.id)
                        ? "bg-coral text-white border-coral shadow-sm"
                        : "border-line text-ink/60 hover:text-ink hover:bg-bone",
                    ].join(" ")}
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCoachSelection("manual")}
                  className={[
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
                    coachSelection === "manual"
                      ? "bg-coral text-white border-coral shadow-sm"
                      : "border-line text-ink/60 hover:text-ink hover:bg-bone",
                  ].join(" ")}
                >
                  직접 입력
                </button>
              </div>
              {coachSelection === "manual" && (
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="이름 입력"
                  className="w-full max-w-xs mt-2 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-ink/50 mb-1">정산 기준월</label>
                <input
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="block text-xs text-ink/50 mb-1">고용형태</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                >
                  {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((type) => (
                    <option key={type} value={type}>
                      {EMPLOYMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink/50 mb-1">입사일</label>
                <input
                  type="date"
                  value={hiredAt}
                  onChange={(e) => setHiredAt(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
              </div>
              {employmentType === "regular" && (
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isTeamLead}
                      onChange={(e) => setIsTeamLead(e.target.checked)}
                    />
                    팀장
                  </label>
                </div>
              )}
              <div>
                <label className="block text-xs text-ink/50 mb-1">
                  1:1 수업 횟수 {loadingCounts && <span className="text-coral">불러오는 중…</span>}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={sessionCount1on1}
                  onChange={(e) => setSessionCount1on1(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="block text-xs text-ink/50 mb-1">2:1 수업 횟수</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={sessionCount2on1}
                  onChange={(e) => setSessionCount2on1(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-ink/50 mb-1">보수월액(4대보험 신고액, 선택)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={declaredMonthlyCompensation}
                      onChange={(e) => {
                        setDeclaredMonthlyCompensation(e.target.value);
                        setDeclaredCompMessage(null);
                      }}
                      placeholder="비워두면 당월 급여 기준으로 계산"
                      className="w-56 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                    />
                    <span className="text-sm text-ink/40 shrink-0">원</span>
                  </div>
                  {selectedCoach ? (
                    <button
                      type="button"
                      onClick={handleSaveDeclaredComp}
                      disabled={savingDeclaredComp}
                      className="shrink-0 rounded-full border border-coral/40 text-coral px-3 py-1.5 text-xs font-medium hover:bg-coral/10 transition disabled:opacity-50"
                    >
                      {savingDeclaredComp ? "저장 중..." : "직원 정보에 저장"}
                    </button>
                  ) : (
                    <span className="text-xs text-ink/40">
                      직원을 선택해야 저장할 수 있어요(선택 전엔 이 계산에만 임시로 반영돼요)
                    </span>
                  )}
                  {declaredCompMessage && <span className="text-xs text-sage">{declaredCompMessage}</span>}
                </div>
                <p className="text-[11px] text-ink/40 mt-1">
                  값을 입력하면 그 금액을 4대보험(국민연금·건강보험·고용보험) 산정 기준으로 그대로
                  쓰고, 비워두면 지금처럼 당월 급여 기준으로 계산해요.
                </p>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-ink/50 mb-1">
                  소개 결제 내역 (여러 건 추가 가능, 결제 수단별로 부가세 처리가 달라요)
                </label>
                <div className="space-y-2">
                  {referralEntries.map((entry, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        value={entry.note}
                        onChange={(e) => updateReferralEntry(i, { note: e.target.value })}
                        placeholder="내용 (예: 김철수 소개)"
                        className="flex-1 min-w-[10rem] rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={entry.amount}
                        onChange={(e) => updateReferralEntry(i, { amount: e.target.value })}
                        placeholder="결제 금액"
                        className="w-32 shrink-0 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                      />
                      <select
                        value={entry.paymentMethod}
                        onChange={(e) =>
                          updateReferralEntry(i, {
                            paymentMethod: e.target.value as ReferralPaymentMethod,
                          })
                        }
                        className="shrink-0 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-coral"
                      >
                        {(Object.keys(REFERRAL_PAYMENT_METHOD_LABEL) as ReferralPaymentMethod[]).map(
                          (method) => (
                            <option key={method} value={method}>
                              {REFERRAL_PAYMENT_METHOD_LABEL[method]}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeReferralEntry(i)}
                        disabled={referralEntries.length === 1}
                        className="shrink-0 text-xs text-coral hover:opacity-70 disabled:opacity-30"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addReferralEntry}
                  className="mt-2 text-xs text-ink/50 hover:text-coral"
                >
                  + 줄 추가
                </button>
                {referralRawTotal > 0 && (
                  <p className="text-xs text-ink/40 mt-1">
                    결제 금액 합계 {referralRawTotal.toLocaleString("ko-KR")}원 · 공급가액 환산
                    합계 {Math.round(referralSupplyAmount).toLocaleString("ko-KR")}원
                  </p>
                )}
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-ink/50 mb-1">
                  초과 수업 안분 방식 (1:1·2:1 혼합 시)
                </label>
                <select
                  value={allocationOrder}
                  onChange={(e) => setAllocationOrder(e.target.value as AllocationOrder)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                >
                  {ALLOCATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <PayrollResultCards
            employeeName={employeeName || "이름 미입력"}
            yearMonth={yearMonth}
            result={result}
            comparisonResult={comparisonResult}
            comparisonEmploymentType={comparisonEmploymentType}
            tenureSimulations={tenureSimulations}
          />

          <div className="no-print flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-coral text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "이 결과 저장"}
            </button>
            <PrintButton />
            {saveMessage && <span className="text-sm text-sage">{saveMessage}</span>}
            {error && <span className="text-sm text-coral">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
