"use client";

import { useEffect, useState } from "react";
import { DEFAULT_INCOME_TAX_SETTINGS } from "@/lib/income-tax/config";
import type { IncomeTaxBreakdown, IncomeTaxSettings } from "@/lib/income-tax/config";

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function settingsToForm(settings: IncomeTaxSettings): Record<string, string> {
  return {
    monthlyRent: String(settings.monthlyRent),
    monthlyUtilities: String(settings.monthlyUtilities),
    monthlySupplies: String(settings.monthlySupplies),
    monthlyMarketing: String(settings.monthlyMarketing),
    cardFeeRate: String(Math.round(settings.cardFeeRate * 100 * 1000) / 1000),
    monthlyIncomeDeduction: String(settings.monthlyIncomeDeduction),
  };
}

const EXPENSE_FIELDS = [
  { key: "monthlyRent", label: "월세", unit: "원" },
  { key: "monthlyUtilities", label: "관리비", unit: "원" },
  { key: "monthlySupplies", label: "장비·소모품", unit: "원" },
  { key: "monthlyMarketing", label: "마케팅비", unit: "원" },
  { key: "cardFeeRate", label: "카드 수수료율", unit: "%" },
  { key: "monthlyIncomeDeduction", label: "월 소득공제(기본공제·노란우산공제 등)", unit: "원" },
] as const;

/** "종합소득세 예비비" 카드의 "필요경비 설정 · 과세표준 수정" 버튼으로 열리는
    패널. 저수지 카드 그리드의 한 칸이 아니라 "저수지 관리" 카드 전체 너비를
    그대로 써서(부모 ReserveDashboard가 그리드 바깥에 렌더링함) 모바일·패드·
    데스크톱 어디서든 입력칸이 넉넉하게 보이게 한다. 열고 닫는 상태는 부모가
    들고 있어서 이 컴포넌트는 열려 있을 때만 마운트된다. */
export function IncomeTaxDetail({
  monthKey,
  breakdown,
  onSaved,
}: {
  monthKey: string;
  breakdown: IncomeTaxBreakdown | null;
  onSaved: () => void;
}) {
  const [settingsForm, setSettingsForm] = useState<Record<string, string> | null>(null);
  const [overrideInput, setOverrideInput] = useState(
    breakdown?.taxableIncomeOverride != null ? String(breakdown.taxableIncomeOverride) : "",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/income-tax-settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "설정을 불러오지 못했어요.");
        if (!cancelled) setSettingsForm(settingsToForm(data.settings as IncomeTaxSettings));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "설정을 불러오지 못했어요.");
          setSettingsForm(settingsToForm(DEFAULT_INCOME_TAX_SETTINGS));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: string, value: string) {
    setSettingsForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage(null);
  }

  async function saveSettings() {
    if (!settingsForm) return;
    const monthlyRent = Number(settingsForm.monthlyRent);
    const monthlyUtilities = Number(settingsForm.monthlyUtilities);
    const monthlySupplies = Number(settingsForm.monthlySupplies);
    const monthlyMarketing = Number(settingsForm.monthlyMarketing);
    const cardFeePercent = Number(settingsForm.cardFeeRate);
    const monthlyIncomeDeduction = Number(settingsForm.monthlyIncomeDeduction);

    if (
      !Number.isFinite(monthlyRent) ||
      monthlyRent < 0 ||
      !Number.isFinite(monthlyUtilities) ||
      monthlyUtilities < 0 ||
      !Number.isFinite(monthlySupplies) ||
      monthlySupplies < 0 ||
      !Number.isFinite(monthlyMarketing) ||
      monthlyMarketing < 0 ||
      !Number.isFinite(cardFeePercent) ||
      cardFeePercent < 0 ||
      cardFeePercent > 100 ||
      !Number.isFinite(monthlyIncomeDeduction) ||
      monthlyIncomeDeduction < 0
    ) {
      setError("값을 다시 확인해주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/income-tax-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyRent,
          monthlyUtilities,
          monthlySupplies,
          monthlyMarketing,
          cardFeeRate: cardFeePercent / 100,
          monthlyIncomeDeduction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했어요.");
      setSettingsForm(settingsToForm(data.settings as IncomeTaxSettings));
      setMessage("저장했어요. \"이번 달 정산\"을 다시 누르면 적립액에 반영돼요.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOverride() {
    setSavingOverride(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/income-tax-settings/override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthKey,
          taxableIncome: overrideInput.trim() === "" ? null : Number(overrideInput),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했어요.");
      setMessage("저장했어요. \"이번 달 정산\"을 다시 누르면 적립액에 반영돼요.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div className="rounded-xl bg-white border border-line/60 p-4 sm:p-6 space-y-5">
      {breakdown && (
        <div className="space-y-1 text-xs sm:text-sm text-ink/60 border-b border-line/40 pb-4">
          <p className="font-medium text-ink/70">이번 달 계산 (참고용 미리보기)</p>
          <p>총수입(부가세 제외) {formatWon(breakdown.revenueExVat)}</p>
          <p>
            필요경비 {formatWon(breakdown.totalExpense)} = 월세 {formatWon(breakdown.rent)} + 관리비{" "}
            {formatWon(breakdown.utilities)} + 장비·소모품 {formatWon(breakdown.supplies)} + 마케팅비{" "}
            {formatWon(breakdown.marketing)} + 인건비 {formatWon(breakdown.payroll)} + 카드 수수료{" "}
            {formatWon(breakdown.cardFee)}
          </p>
          <p>사업소득금액 {formatWon(breakdown.businessIncome)} − 소득공제 {formatWon(breakdown.incomeDeduction)}</p>
          <p>
            과세표준(자동) {formatWon(breakdown.taxableIncomeAuto)}
            {breakdown.taxableIncomeOverride != null && (
              <> · 직접 입력 적용 중 → {formatWon(breakdown.taxableIncomeOverride)}</>
            )}
          </p>
          <p className="text-ink/70">
            예비비(과세표준 × 15%) = <span className="font-medium">{formatWon(breakdown.reserveAmount)}</span>
          </p>
        </div>
      )}

      <div>
        <p className="text-xs sm:text-sm font-medium text-ink/60 mb-2">이번 달 과세표준 직접 입력</p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <input
            type="number"
            inputMode="numeric"
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            placeholder="비워두면 자동 계산값을 써요"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={saveOverride}
            disabled={savingOverride}
            className="shrink-0 rounded-lg bg-coral text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {savingOverride ? "저장 중..." : "적용"}
          </button>
        </div>
      </div>

      <div className="border-t border-line/40 pt-4">
        <p className="text-xs sm:text-sm font-medium text-ink/60 mb-3">필요경비 설정(매달 똑같이 적용)</p>
        {loading || !settingsForm ? (
          <p className="text-sm text-ink/40">불러오는 중...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXPENSE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-ink/50 mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={settingsForm[field.key]}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-line px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-coral"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                      {field.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="w-full sm:w-auto rounded-lg bg-ink text-white px-6 py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "필요경비 설정 저장"}
            </button>
          </div>
        )}
      </div>

      {message && <p className="text-xs sm:text-sm text-sage">{message}</p>}
      {error && <p className="text-xs sm:text-sm text-coral">{error}</p>}
    </div>
  );
}
