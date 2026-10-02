"use client";

import { useState } from "react";
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

/** "종합소득세 예비비" 카드 전용 — 필요경비 설정(월세·관리비·장비소모품·
    마케팅비·카드 수수료율·월 소득공제)을 고치고, 그 달 과세표준을 직접
    입력해 자동 계산을 덮어쓸 수 있게 한다. 여기서 저장해도 실제 저수지
    적립액은 "이번 달 정산"을 다시 눌러야 반영된다 — 그 전까지는 계산 결과
    미리보기만 바뀐다. */
export function IncomeTaxDetail({
  monthKey,
  breakdown,
  onSaved,
}: {
  monthKey: string;
  breakdown: IncomeTaxBreakdown | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, string> | null>(null);
  const [overrideInput, setOverrideInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError(null);
    setMessage(null);
    setOverrideInput(breakdown?.taxableIncomeOverride != null ? String(breakdown.taxableIncomeOverride) : "");
    if (settingsForm) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/income-tax-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "설정을 불러오지 못했어요.");
      setSettingsForm(settingsToForm(data.settings as IncomeTaxSettings));
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 불러오지 못했어요.");
      setSettingsForm(settingsToForm(DEFAULT_INCOME_TAX_SETTINGS));
    } finally {
      setLoading(false);
    }
  }

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
    <div>
      <button
        type="button"
        onClick={toggleOpen}
        className="mt-1 w-full rounded-full border border-line px-3 py-1.5 text-xs hover:bg-white transition"
      >
        {open ? "닫기" : "필요경비 설정 · 과세표준 수정"}
      </button>

      {open && (
        <div className="mt-1.5 space-y-3 rounded-lg bg-white border border-line/50 p-3">
          {breakdown && (
            <div className="space-y-1 text-[11px] text-ink/60 border-b border-line/40 pb-2">
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
            <p className="text-[11px] font-medium text-ink/60 mb-1">이번 달 과세표준 직접 입력</p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
                placeholder="비워두면 자동 계산값을 써요"
                className="w-full rounded-md border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={saveOverride}
                disabled={savingOverride}
                className="shrink-0 rounded-md bg-coral text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {savingOverride ? "저장 중..." : "적용"}
              </button>
            </div>
          </div>

          <div className="border-t border-line/40 pt-2.5">
            <p className="text-[11px] font-medium text-ink/60 mb-1.5">필요경비 설정(매달 똑같이 적용)</p>
            {loading || !settingsForm ? (
              <p className="text-xs text-ink/40">불러오는 중...</p>
            ) : (
              <div className="space-y-1.5">
                {(
                  [
                    { key: "monthlyRent", label: "월세", unit: "원" },
                    { key: "monthlyUtilities", label: "관리비", unit: "원" },
                    { key: "monthlySupplies", label: "장비·소모품", unit: "원" },
                    { key: "monthlyMarketing", label: "마케팅비", unit: "원" },
                    { key: "cardFeeRate", label: "카드 수수료율", unit: "%" },
                    { key: "monthlyIncomeDeduction", label: "월 소득공제(기본공제·노란우산공제 등)", unit: "원" },
                  ] as const
                ).map((field) => (
                  <div key={field.key} className="flex items-center gap-1.5">
                    <label className="w-[180px] shrink-0 text-[11px] text-ink/50">{field.label}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={settingsForm[field.key]}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="w-full rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                    />
                    <span className="shrink-0 text-[11px] text-ink/40">{field.unit}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving}
                  className="mt-1 w-full rounded-md bg-ink text-white px-2 py-1.5 text-xs font-medium hover:bg-coral transition disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "필요경비 설정 저장"}
                </button>
              </div>
            )}
          </div>

          {message && <p className="text-[11px] text-sage">{message}</p>}
          {error && <p className="text-[11px] text-coral">{error}</p>}
        </div>
      )}
    </div>
  );
}
