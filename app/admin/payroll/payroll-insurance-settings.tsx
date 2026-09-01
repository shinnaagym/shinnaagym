"use client";

import { useState } from "react";
import { DEFAULT_INSURANCE_RATES } from "@/lib/payroll/config";
import type { InsuranceRates } from "@/lib/payroll";

// 0.0475 같은 요율을 편집용 입력칸에 "4.75"로 보여준다. 부동소수점 오차로
// 4.750000000000001 같은 값이 나오는 걸 막기 위해 소수 4자리까지 반올림한
// 뒤 뒤에 붙는 불필요한 0을 정리한다.
function rateToPercentInput(rate: number): string {
  return String(Math.round(rate * 100 * 10_000) / 10_000);
}

function percentInputToRate(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

interface RateFieldConfig {
  key: keyof InsuranceRates;
  label: string;
  unit: "percent" | "won";
  help?: string;
}

const FIELDS: RateFieldConfig[] = [
  { key: "nationalPensionRate", label: "국민연금 요율", unit: "percent", help: "근로자 부담분(전체 요율의 절반)" },
  {
    key: "nationalPensionCap",
    label: "국민연금 상한액",
    unit: "won",
    help: "보수월액이 이 금액을 넘으면 초과분에는 보험료가 붙지 않아요. 매년 7월에 바뀌어요.",
  },
  { key: "healthInsuranceRate", label: "건강보험 요율", unit: "percent", help: "근로자 부담분, 상한 없음" },
  {
    key: "longTermCareRateOfHealthInsurance",
    label: "장기요양 요율",
    unit: "percent",
    help: "건강보험료 대비 비율(건강보험료 × 이 요율), 상한 없음",
  },
  { key: "employmentInsuranceRate", label: "고용보험 요율", unit: "percent", help: "근로자 부담분, 상한 없음" },
];

function ratesToFormState(rates: InsuranceRates): Record<keyof InsuranceRates, string> {
  return {
    nationalPensionRate: rateToPercentInput(rates.nationalPensionRate),
    nationalPensionCap: String(rates.nationalPensionCap),
    healthInsuranceRate: rateToPercentInput(rates.healthInsuranceRate),
    longTermCareRateOfHealthInsurance: rateToPercentInput(rates.longTermCareRateOfHealthInsurance),
    employmentInsuranceRate: rateToPercentInput(rates.employmentInsuranceRate),
  };
}

export function PayrollInsuranceSettings({
  rates,
  onSaved,
}: {
  rates: InsuranceRates;
  onSaved: (rates: InsuranceRates) => void;
}) {
  const [form, setForm] = useState(() => ratesToFormState(rates));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function updateField(key: keyof InsuranceRates, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function resetToDefault() {
    setForm(ratesToFormState(DEFAULT_INSURANCE_RATES));
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    const nationalPensionRate = percentInputToRate(form.nationalPensionRate);
    const healthInsuranceRate = percentInputToRate(form.healthInsuranceRate);
    const longTermCareRateOfHealthInsurance = percentInputToRate(
      form.longTermCareRateOfHealthInsurance,
    );
    const employmentInsuranceRate = percentInputToRate(form.employmentInsuranceRate);
    const nationalPensionCap = Number(form.nationalPensionCap);

    if (
      nationalPensionRate === null ||
      healthInsuranceRate === null ||
      longTermCareRateOfHealthInsurance === null ||
      employmentInsuranceRate === null ||
      !Number.isFinite(nationalPensionCap) ||
      nationalPensionCap <= 0
    ) {
      setError("값을 다시 확인해주세요. 요율은 0~100 사이, 상한액은 0보다 큰 숫자여야 해요.");
      return;
    }

    const nextRates: InsuranceRates = {
      nationalPensionRate,
      nationalPensionCap: Math.round(nationalPensionCap),
      healthInsuranceRate,
      longTermCareRateOfHealthInsurance,
      employmentInsuranceRate,
    };

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/payroll/insurance-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextRates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      const data = await res.json();
      onSaved(data.rates);
      setForm(ratesToFormState(data.rates));
      setMessage("저장했어요. 이후 급여 계산부터 새 요율이 적용돼요.");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5 space-y-4">
      <div>
        <h3 className="font-display text-base mb-1">4대보험 요율 설정</h3>
        <p className="text-xs text-ink/50">
          여기서 저장한 값이 앞으로의 급여 계산·저장에 바로 적용돼요. 저장한 적이 없으면
          기본값(국민연금 4.75%, 상한 {DEFAULT_INSURANCE_RATES.nationalPensionCap.toLocaleString("ko-KR")}
          원 등)을 써요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-xs text-ink/50 mb-1">{field.label}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={form[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <span className="text-sm text-ink/40 shrink-0">{field.unit === "percent" ? "%" : "원"}</span>
            </div>
            {field.help && <p className="text-[11px] text-ink/40 mt-1">{field.help}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-coral text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          className="text-xs text-ink/50 hover:text-coral"
        >
          기본값으로 되돌리기
        </button>
        {message && <span className="text-sm text-sage">{message}</span>}
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
    </div>
  );
}
