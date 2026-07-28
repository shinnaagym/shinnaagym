"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  STANCE_LEG_OPTIONS,
  LEG_CROSS_OPTIONS,
  SLEEP_POSITION_OPTIONS,
  SLEEP_AMOUNT_OPTIONS,
  SLEEP_QUALITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  PAIN_ONSET_TYPE_OPTIONS,
  PAIN_PERSISTENCE_OPTIONS,
  PAIN_CYCLE_PERIODS,
  PAIN_CHARACTERISTIC_OPTIONS,
} from "@/lib/intake-questionnaire";
import { NRS_PAIN_OPTIONS } from "@/lib/assessment-movements";
import { PrintButton } from "@/app/components/PrintButton";

export interface IntakeFormState {
  stanceLeg: string;
  legCross: string;
  sleepPosition: string;
  frequentMovement: string;
  sleepAmount: string;
  sleepQuality: string;
  stressLevel: string;
  drinking: boolean;
  smoking: boolean;
  otherNotes: string;
  painOnsetPeriod: string;
  painOnsetType: string;
  painMoi: string;
  painProgressNote: string;
  painNrsBest: number | null;
  painNrsWorst: number | null;
  painNrsCurrent: number | null;
  painPersistence: string;
  painCycleSituation: string;
  painCycleMorning: string;
  painCycleNoon: string;
  painCycleEvening: string;
  painCycleNight: string;
  painCharacteristics: string[];
  painCharacteristicsOther: string;
  improveFactors: string;
  worsenFactors: string;
  perceivedCause: string;
  postPainAction: string;
  pastSamePainHistory: string;
  pastTreatment: string;
  majorComplaint: string;
  minorComplaint: string;
}

export const EMPTY_INTAKE_FORM_STATE: IntakeFormState = {
  stanceLeg: "",
  legCross: "",
  sleepPosition: "",
  frequentMovement: "",
  sleepAmount: "",
  sleepQuality: "",
  stressLevel: "",
  drinking: false,
  smoking: false,
  otherNotes: "",
  painOnsetPeriod: "",
  painOnsetType: "",
  painMoi: "",
  painProgressNote: "",
  painNrsBest: null,
  painNrsWorst: null,
  painNrsCurrent: null,
  painPersistence: "",
  painCycleSituation: "",
  painCycleMorning: "",
  painCycleNoon: "",
  painCycleEvening: "",
  painCycleNight: "",
  painCharacteristics: [],
  painCharacteristicsOther: "",
  improveFactors: "",
  worsenFactors: "",
  perceivedCause: "",
  postPainAction: "",
  pastSamePainHistory: "",
  pastTreatment: "",
  majorComplaint: "",
  minorComplaint: "",
};

function pillClass(active: boolean): string {
  return [
    "rounded-full px-3 py-1.5 text-xs font-medium transition border",
    active ? "bg-coral text-white border-coral" : "border-line text-ink/60 hover:bg-bone",
  ].join(" ");
}

function textareaClass(): string {
  return "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none";
}

function RadioPills({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
          className={pillClass(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NrsPills({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NRS_PAIN_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === Number(n) ? null : Number(n))}
          className={[
            "h-8 w-8 rounded-full border text-xs font-medium transition",
            value === Number(n) ? "bg-coral text-white border-coral" : "border-line text-ink/60 hover:bg-bone",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function PainCycleToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-10 text-ink/70">{label}</span>
      <button
        type="button"
        onClick={() => onChange(value === "up" ? "" : "up")}
        className={[
          "h-8 w-8 rounded-lg border text-sm transition",
          value === "up" ? "bg-coral text-white border-coral" : "border-line text-ink/50 hover:bg-bone",
        ].join(" ")}
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => onChange(value === "down" ? "" : "down")}
        className={[
          "h-8 w-8 rounded-lg border text-sm transition",
          value === "down" ? "bg-coral text-white border-coral" : "border-line text-ink/50 hover:bg-bone",
        ].join(" ")}
      >
        ▼
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs text-ink/40 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-5 mb-4">
      <h2 className="font-display text-lg mb-4">{title}</h2>
      {children}
    </div>
  );
}

export function IntakeForm({
  memberId,
  memberName,
  initialData,
  updatedAt,
}: {
  memberId: number;
  memberName: string;
  initialData?: IntakeFormState;
  updatedAt?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<IntakeFormState>(initialData ?? EMPTY_INTAKE_FORM_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(p: Partial<IntakeFormState>) {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...p }));
  }

  function toggleCharacteristic(key: string) {
    patch({
      painCharacteristics: form.painCharacteristics.includes(key)
        ? form.painCharacteristics.filter((k) => k !== key)
        : [...form.painCharacteristics, key],
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/intake`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Intake</p>
          <h1 className="font-display text-2xl">초진 문진표</h1>
          {updatedAt && (
            <p className="text-xs text-ink/40 mt-1">마지막 저장: {updatedAt}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 text-xs text-ink/60 leading-relaxed mb-6">
        <p className="font-medium text-ink mb-1">민감정보 처리 안내</p>
        <p>
          이 문진표에는 통증·수면·스트레스·음주/흡연 등 「개인정보 보호법」상 민감정보가
          포함되어 있습니다. 해당 정보는 회원가입 계약서 제4조(민감정보 수집·이용 동의)에 따라
          별도 동의를 받은 정보이며, 오직 회원 맞춤형 운동 프로그램 설계 목적으로만 사용됩니다.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white px-5 py-4 mb-4">
        <p className="text-xs text-ink/40 mb-1">회원 이름</p>
        <p className="font-medium">{memberName}</p>
      </div>

      <SectionCard title="기본정보">
        <Field label="짝다리">
          <RadioPills options={STANCE_LEG_OPTIONS} value={form.stanceLeg} onChange={(v) => patch({ stanceLeg: v })} />
        </Field>
        <Field label="다리꼬기">
          <RadioPills options={LEG_CROSS_OPTIONS} value={form.legCross} onChange={(v) => patch({ legCross: v })} />
        </Field>
        <Field label="자는 자세">
          <RadioPills
            options={SLEEP_POSITION_OPTIONS}
            value={form.sleepPosition}
            onChange={(v) => patch({ sleepPosition: v })}
          />
        </Field>
        <Field label="자주 하는 동작">
          <textarea
            value={form.frequentMovement}
            onChange={(e) => patch({ frequentMovement: e.target.value })}
            rows={2}
            className={textareaClass()}
          />
        </Field>
        <Field label="수면 양">
          <RadioPills options={SLEEP_AMOUNT_OPTIONS} value={form.sleepAmount} onChange={(v) => patch({ sleepAmount: v })} />
        </Field>
        <Field label="수면 질">
          <RadioPills
            options={SLEEP_QUALITY_OPTIONS}
            value={form.sleepQuality}
            onChange={(v) => patch({ sleepQuality: v })}
          />
        </Field>
        <Field label="스트레스">
          <RadioPills
            options={STRESS_LEVEL_OPTIONS}
            value={form.stressLevel}
            onChange={(v) => patch({ stressLevel: v })}
          />
        </Field>
        <Field label="음주 및 흡연">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.drinking}
                onChange={(e) => patch({ drinking: e.target.checked })}
                className="accent-coral"
              />
              음주
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.smoking}
                onChange={(e) => patch({ smoking: e.target.checked })}
                className="accent-coral"
              />
              흡연
            </label>
          </div>
        </Field>
        <Field label="다른 특이사항">
          <textarea
            value={form.otherNotes}
            onChange={(e) => patch({ otherNotes: e.target.value })}
            rows={2}
            className={textareaClass()}
          />
        </Field>
      </SectionCard>

      <SectionCard title="통증의 발생">
        <Field label="기간">
          <input
            value={form.painOnsetPeriod}
            onChange={(e) => patch({ painOnsetPeriod: e.target.value })}
            placeholder="예: 2주 전부터"
            className={textareaClass()}
          />
        </Field>
        <Field label="양상">
          <RadioPills
            options={PAIN_ONSET_TYPE_OPTIONS}
            value={form.painOnsetType}
            onChange={(v) => patch({ painOnsetType: v })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="통증의 발생 과정 (MOI)">
        <textarea
          value={form.painMoi}
          onChange={(e) => patch({ painMoi: e.target.value })}
          rows={4}
          placeholder="통증이 어떻게 시작되었는지 서술"
          className={textareaClass()}
        />
      </SectionCard>

      <SectionCard title="통증의 강도 (NRS)">
        <Field label="경과">
          <input
            value={form.painProgressNote}
            onChange={(e) => patch({ painProgressNote: e.target.value })}
            placeholder="예: 점차 심해짐"
            className={textareaClass()}
          />
        </Field>
        <Field label="좋을 때">
          <NrsPills value={form.painNrsBest} onChange={(v) => patch({ painNrsBest: v })} />
        </Field>
        <Field label="나쁠 때">
          <NrsPills value={form.painNrsWorst} onChange={(v) => patch({ painNrsWorst: v })} />
        </Field>
        <Field label="현재">
          <NrsPills value={form.painNrsCurrent} onChange={(v) => patch({ painNrsCurrent: v })} />
        </Field>
      </SectionCard>

      <SectionCard title="통증의 지속성">
        <RadioPills
          options={PAIN_PERSISTENCE_OPTIONS}
          value={form.painPersistence}
          onChange={(v) => patch({ painPersistence: v })}
        />
      </SectionCard>

      <SectionCard title="통증의 주기">
        <Field label="상황">
          <input
            value={form.painCycleSituation}
            onChange={(e) => patch({ painCycleSituation: e.target.value })}
            placeholder="예: 앉아 있을 때"
            className={textareaClass()}
          />
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PAIN_CYCLE_PERIODS.map((period) => {
            const key = (
              {
                morning: "painCycleMorning",
                noon: "painCycleNoon",
                evening: "painCycleEvening",
                night: "painCycleNight",
              } as const
            )[period.key];
            return (
              <PainCycleToggle
                key={period.key}
                label={period.label}
                value={form[key]}
                onChange={(v) => patch({ [key]: v } as Partial<IntakeFormState>)}
              />
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="통증의 특징">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {PAIN_CHARACTERISTIC_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-2 text-sm rounded-lg border border-line px-3 py-2 cursor-pointer hover:bg-bone/40"
            >
              <input
                type="checkbox"
                checked={form.painCharacteristics.includes(opt.key)}
                onChange={() => toggleCharacteristic(opt.key)}
                className="accent-coral"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <Field label="기타">
          <input
            value={form.painCharacteristicsOther}
            onChange={(e) => patch({ painCharacteristicsOther: e.target.value })}
            className={textareaClass()}
          />
        </Field>
      </SectionCard>

      <SectionCard title="통증의 양상">
        <p className="text-xs text-ink/50 mb-3">좋아지거나 나빠지는 자세나 활동</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="좋아지는 경우">
            <textarea
              value={form.improveFactors}
              onChange={(e) => patch({ improveFactors: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
          <Field label="나빠지는 경우">
            <textarea
              value={form.worsenFactors}
              onChange={(e) => patch({ worsenFactors: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="병력 및 대처">
        <Field label="환자가 생각하는 통증의 원인">
          <textarea
            value={form.perceivedCause}
            onChange={(e) => patch({ perceivedCause: e.target.value })}
            rows={2}
            className={textareaClass()}
          />
        </Field>
        <Field label="통증 발생 후 대처">
          <textarea
            value={form.postPainAction}
            onChange={(e) => patch({ postPainAction: e.target.value })}
            rows={2}
            className={textareaClass()}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="동일 통증 과거력">
            <textarea
              value={form.pastSamePainHistory}
              onChange={(e) => patch({ pastSamePainHistory: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
          <Field label="과거 치료 내용">
            <textarea
              value={form.pastTreatment}
              onChange={(e) => patch({ pastTreatment: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Chief Complaint">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Major complain">
            <textarea
              value={form.majorComplaint}
              onChange={(e) => patch({ majorComplaint: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
          <Field label="Minor complain">
            <textarea
              value={form.minorComplaint}
              onChange={(e) => patch({ minorComplaint: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1 mb-6">
        <p>신나아짐 본점 T. 010-6859-6114</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-6859-6114)</p>
      </div>

      {error && <p className="text-sm text-coral mb-3 no-print">{error}</p>}
      {saved && !error && <p className="text-sm text-sage mb-3 no-print">저장되었어요.</p>}

      <div className="flex gap-2 no-print">
        <PrintButton className="rounded-full border border-line px-4 py-2.5 text-sm hover:bg-bone transition" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 rounded-full bg-ink text-white py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "문진표 저장하기"}
        </button>
      </div>
    </div>
  );
}
