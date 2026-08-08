"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EXERCISE_PURPOSE_OPTIONS,
  VISIT_CHANNEL_OPTIONS,
  STANCE_LEG_OPTIONS,
  LEG_CROSS_OPTIONS,
  SLEEP_POSITION_OPTIONS,
  SLEEP_QUALITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  PAIN_ONSET_TYPE_OPTIONS,
  PAIN_CYCLE_PERIODS,
  PAIN_CHARACTERISTIC_OPTIONS,
} from "@/lib/intake-questionnaire";
import { NRS_PAIN_OPTIONS } from "@/lib/assessment-movements";
import {
  ODI_ITEMS,
  NDI_ITEMS,
  QUICKDASH_ITEMS,
  KOOS12_ITEMS,
  FAAM_ADL_ITEMS,
  FAAM_SPORTS_ITEMS,
  STARTBACK_ITEMS,
  computeOdiNdiScore,
  computeQuickDashScore,
  computeKoos12Score,
  computeFaamScore,
  computeStartBackScore,
} from "@/lib/prom-instruments";
import { PromAccordion } from "@/app/components/PromAccordion";
import { PrintButton } from "@/app/components/PrintButton";
import { BodyPainDiagram } from "@/app/components/BodyPainDiagram";
import {
  criterionIcon,
  odiCriterion,
  ndiCriterion,
  quickdashCriterion,
  koos12Criterion,
  faamAdlCriterion,
  faamSportsCriterion,
  startbackCriterion,
} from "@/lib/performance-criteria";
import type { PainMovementEntry } from "@/lib/db";
import { EMPTY_INTAKE_FORM_STATE, EMPTY_PAIN_MOVEMENT, type IntakeFormState } from "./intake-form-state";

export type { IntakeFormState } from "./intake-form-state";

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

function PainMovementRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: PainMovementEntry;
  onChange: (patch: Partial<PainMovementEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={entry.movement}
          onChange={(e) => onChange({ movement: e.target.value })}
          placeholder="예: 계단 내려갈 때"
          className={textareaClass() + " flex-1"}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-coral hover:opacity-70 whitespace-nowrap"
        >
          삭제
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-ink/40 mb-1">좋을 때</p>
          <NrsPills value={entry.nrsBest} onChange={(v) => onChange({ nrsBest: v })} />
        </div>
        <div>
          <p className="text-xs text-ink/40 mb-1">나쁠 때</p>
          <NrsPills value={entry.nrsWorst} onChange={(v) => onChange({ nrsWorst: v })} />
        </div>
        <div>
          <p className="text-xs text-ink/40 mb-1">현재</p>
          <NrsPills value={entry.nrsCurrent} onChange={(v) => onChange({ nrsCurrent: v })} />
        </div>
      </div>
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

interface PainRegionDef {
  key: string;
  label: string;
  promKeys: string[];
}

const PAIN_REGIONS: PainRegionDef[] = [
  { key: "lumbar", label: "요추 / 허리", promKeys: ["odi", "startback"] },
  { key: "cervical", label: "경추 / 목", promKeys: ["ndi"] },
  { key: "shoulder", label: "어깨 / 상지", promKeys: ["quickdash"] },
  { key: "knee", label: "무릎", promKeys: ["koos12"] },
  { key: "ankleFoot", label: "발 / 발목", promKeys: ["faamAdl", "faamSports"] },
];

/** 이미 값이 입력된 PROM이 있으면 그에 대응하는 통증 부위를 처음부터 선택된 상태로 보여준다. */
function initialRegionsFromAnswers(data: IntakeFormState): Set<string> {
  const hasAnswers = (a: Record<string, number>) => Object.keys(a).length > 0;
  const regions = new Set<string>();
  if (hasAnswers(data.odiAnswers) || hasAnswers(data.startbackAnswers)) regions.add("lumbar");
  if (hasAnswers(data.ndiAnswers)) regions.add("cervical");
  if (hasAnswers(data.quickdashAnswers)) regions.add("shoulder");
  if (hasAnswers(data.koos12Answers)) regions.add("knee");
  if (hasAnswers(data.faamAdlAnswers) || hasAnswers(data.faamSportsAnswers)) regions.add("ankleFoot");
  return regions;
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
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(() =>
    initialRegionsFromAnswers(initialData ?? EMPTY_INTAKE_FORM_STATE),
  );
  const [openProm, setOpenProm] = useState<Set<string>>(new Set());

  function patch(p: Partial<IntakeFormState>) {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...p }));
  }

  function togglePainRegion(key: string) {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      const region = PAIN_REGIONS.find((r) => r.key === key);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (region) setOpenProm((prevOpen) => new Set([...prevOpen, ...region.promKeys]));
      }
      return next;
    });
  }

  function togglePromOpen(key: string) {
    setOpenProm((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visiblePromKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const region of PAIN_REGIONS) {
      if (selectedRegions.has(region.key)) {
        for (const k of region.promKeys) keys.add(k);
      }
    }
    return keys;
  }, [selectedRegions]);

  const odiScore = computeOdiNdiScore(form.odiAnswers);
  const ndiScore = computeOdiNdiScore(form.ndiAnswers);
  const quickdashScore = computeQuickDashScore(form.quickdashAnswers);
  const koos12Score = computeKoos12Score(form.koos12Answers);
  const faamAdlScore = computeFaamScore(form.faamAdlAnswers);
  const faamSportsScore = computeFaamScore(form.faamSportsAnswers);
  const startBackScore = computeStartBackScore(form.startbackAnswers);

  // 선택한 부위에 해당하는 퍼포먼스 단계 전환 기준만 걸러서 표준 설문(PROM) 바로
  // 아래에 보여준다 — PAIN_REGIONS의 promKeys 매핑을 그대로 재사용한다.
  const visibleCriteria = [
    { key: "odi", criterion: odiCriterion(odiScore) },
    { key: "ndi", criterion: ndiCriterion(ndiScore) },
    { key: "quickdash", criterion: quickdashCriterion(quickdashScore) },
    { key: "koos12", criterion: koos12Criterion(koos12Score) },
    { key: "faamAdl", criterion: faamAdlCriterion(faamAdlScore) },
    { key: "faamSports", criterion: faamSportsCriterion(faamSportsScore) },
    { key: "startback", criterion: startbackCriterion(startBackScore) },
  ].filter((c) => visiblePromKeys.has(c.key));

  const setOdiAnswer = (key: string, v: number) =>
    patch({ odiAnswers: { ...form.odiAnswers, [key]: v } });
  const setNdiAnswer = (key: string, v: number) =>
    patch({ ndiAnswers: { ...form.ndiAnswers, [key]: v } });
  const setQuickdashAnswer = (key: string, v: number) =>
    patch({ quickdashAnswers: { ...form.quickdashAnswers, [key]: v } });
  const setKoos12Answer = (key: string, v: number) =>
    patch({ koos12Answers: { ...form.koos12Answers, [key]: v } });
  const setFaamAdlAnswer = (key: string, v: number) =>
    patch({ faamAdlAnswers: { ...form.faamAdlAnswers, [key]: v } });
  const setFaamSportsAnswer = (key: string, v: number) =>
    patch({ faamSportsAnswers: { ...form.faamSportsAnswers, [key]: v } });
  const setStartbackAnswer = (key: string, v: number) =>
    patch({ startbackAnswers: { ...form.startbackAnswers, [key]: v } });

  function toggleCharacteristic(key: string) {
    patch({
      painCharacteristics: form.painCharacteristics.includes(key)
        ? form.painCharacteristics.filter((k) => k !== key)
        : [...form.painCharacteristics, key],
    });
  }

  function toggleExercisePurpose(key: string) {
    patch({
      exercisePurposes: form.exercisePurposes.includes(key)
        ? form.exercisePurposes.filter((k) => k !== key)
        : [...form.exercisePurposes, key],
    });
  }

  function updatePainMovement(index: number, entryPatch: Partial<PainMovementEntry>) {
    patch({
      painMovements: form.painMovements.map((e, i) => (i === index ? { ...e, ...entryPatch } : e)),
    });
  }

  function addPainMovement() {
    patch({ painMovements: [...form.painMovements, { ...EMPTY_PAIN_MOVEMENT }] });
  }

  function removePainMovement(index: number) {
    patch({ painMovements: form.painMovements.filter((_, i) => i !== index) });
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
      router.back();
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Field label="이름">
            <input
              value={form.intakeName}
              onChange={(e) => patch({ intakeName: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
          <Field label="나이">
            <input
              type="number"
              min="0"
              max="120"
              value={form.age ?? ""}
              onChange={(e) => patch({ age: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
          <Field label="연락처">
            <input
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
        </div>
        <Field label="'신나아짐'에 오게 된 경로">
          <RadioPills
            options={VISIT_CHANNEL_OPTIONS}
            value={form.visitChannel}
            onChange={(v) => patch({ visitChannel: v })}
          />
        </Field>
        {form.visitChannel === "referral" && (
          <Field label="소개해준 사람">
            <input
              value={form.visitChannelReferrerName}
              onChange={(e) => patch({ visitChannelReferrerName: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
        )}
        {form.visitChannel === "other" && (
          <Field label="기타 (직접 입력)">
            <input
              value={form.visitChannelOther}
              onChange={(e) => patch({ visitChannelOther: e.target.value })}
              placeholder="예: 엘리베이터 광고"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
        )}
        <Field label="운동 목적">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {EXERCISE_PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleExercisePurpose(opt.key)}
                className={pillClass(form.exercisePurposes.includes(opt.key))}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            value={form.exercisePurposeOther}
            onChange={(e) => patch({ exercisePurposeOther: e.target.value })}
            placeholder="기타"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
          />
        </Field>
      </SectionCard>

      <SectionCard title="상담 내용">
        <textarea
          value={form.painMoi}
          onChange={(e) => patch({ painMoi: e.target.value })}
          rows={4}
          placeholder="통증이 어떻게 시작되었는지 서술"
          className={textareaClass()}
        />
      </SectionCard>

      <SectionCard title="통증 위치 표시">
        <p className="text-xs text-ink/50 mb-3">
          부위를 고른 뒤, 그림을 손가락(또는 마우스)으로 눌러 아픈 위치를 직접 표시해주세요.
        </p>
        <BodyPainDiagram
          value={{
            front: form.bodyDiagramFront,
            back: form.bodyDiagramBack,
            left: form.bodyDiagramLeft,
            right: form.bodyDiagramRight,
            feet: form.bodyDiagramFeet,
            hands: form.bodyDiagramHands,
          }}
          onChange={(next) =>
            patch({
              bodyDiagramFront: next.front,
              bodyDiagramBack: next.back,
              bodyDiagramLeft: next.left,
              bodyDiagramRight: next.right,
              bodyDiagramFeet: next.feet,
              bodyDiagramHands: next.hands,
            })
          }
        />
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

      <SectionCard title="통증의 강도 (NRS)">
        <p className="text-xs text-ink/50 mb-3">
          통증 나타나는 동작을 추가할 때마다 그 동작의 통증 척도(좋을 때/나쁠 때/현재)를 함께
          기록해주세요.
        </p>
        {form.painMovements.map((entry, i) => (
          <PainMovementRow
            key={i}
            entry={entry}
            onChange={(p) => updatePainMovement(i, p)}
            onRemove={() => removePainMovement(i)}
          />
        ))}
        <button
          type="button"
          onClick={addPainMovement}
          className="rounded-full border border-coral text-coral px-3 py-1.5 text-xs font-medium hover:bg-coral/5 transition"
        >
          + 추가
        </button>
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

      <SectionCard title="생활습관">
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
        <Field label="수면 시간">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={form.sleepHours ?? ""}
              onChange={(e) =>
                patch({ sleepHours: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="예: 6.5"
              className="w-24 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <span className="text-sm text-ink/50">시간</span>
          </div>
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

      <SectionCard title="주요 호소(부위)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="1순위">
            <textarea
              value={form.majorComplaint}
              onChange={(e) => patch({ majorComplaint: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
          <Field label="2순위">
            <textarea
              value={form.minorComplaint}
              onChange={(e) => patch({ minorComplaint: e.target.value })}
              rows={2}
              className={textareaClass()}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="표준 설문(PROM)">
        <p className="text-xs text-ink/50 mb-4">
          통증이 있는 부위를 선택하면 그에 맞는 설문이 아래에 열립니다. 아래 문항은 공식 원문을
          그대로 옮긴 것이 아니라 이해하기 쉽게 재구성한 것으로, 점수는 참고용입니다.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-1">
          {PAIN_REGIONS.map((region) => (
            <button
              key={region.key}
              type="button"
              onClick={() => togglePainRegion(region.key)}
              className={[
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                region.key === "ankleFoot" ? "col-span-2" : "",
                selectedRegions.has(region.key)
                  ? "bg-coral text-white border-coral"
                  : "border-line text-ink/70 hover:bg-bone",
              ].join(" ")}
            >
              {region.label}
            </button>
          ))}
        </div>

        {visibleCriteria.length > 0 && (
          <div className="rounded-xl border border-line/60 bg-bone/40 px-4 py-3 mt-3">
            <p className="text-sm font-medium mb-2">퍼포먼스 단계 전환 기준</p>
            <ul className="divide-y divide-line/50">
              {visibleCriteria.map((c) => (
                <li key={c.key} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span>{criterionIcon(c.criterion.status)}</span>
                    {c.criterion.label}
                  </span>
                  <span className="text-ink/50">{c.criterion.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      {visiblePromKeys.has("odi") && (
        <PromAccordion
          title="ODI (요추 기능장애)"
          scoreLabel={odiScore != null ? `${odiScore}%` : null}
          items={ODI_ITEMS}
          answers={form.odiAnswers}
          onAnswer={setOdiAnswer}
          isOpen={openProm.has("odi")}
          toggleKey="odi"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("ndi") && (
        <PromAccordion
          title="NDI (경추 기능장애)"
          scoreLabel={ndiScore != null ? `${ndiScore}%` : null}
          items={NDI_ITEMS}
          answers={form.ndiAnswers}
          onAnswer={setNdiAnswer}
          isOpen={openProm.has("ndi")}
          toggleKey="ndi"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("quickdash") && (
        <PromAccordion
          title="QuickDASH (상지 기능장애)"
          scoreLabel={quickdashScore != null ? `${quickdashScore}` : null}
          items={QUICKDASH_ITEMS}
          answers={form.quickdashAnswers}
          onAnswer={setQuickdashAnswer}
          isOpen={openProm.has("quickdash")}
          toggleKey="quickdash"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("koos12") && (
        <PromAccordion
          title="KOOS-12 (무릎)"
          scoreLabel={koos12Score != null ? `${koos12Score}` : null}
          items={KOOS12_ITEMS}
          answers={form.koos12Answers}
          onAnswer={setKoos12Answer}
          isOpen={openProm.has("koos12")}
          toggleKey="koos12"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("faamAdl") && (
        <PromAccordion
          title="FAAM ADL (발·발목 일상)"
          scoreLabel={faamAdlScore != null ? `${faamAdlScore}%` : null}
          items={FAAM_ADL_ITEMS}
          answers={form.faamAdlAnswers}
          onAnswer={setFaamAdlAnswer}
          isOpen={openProm.has("faamAdl")}
          toggleKey="faamAdl"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("faamSports") && (
        <PromAccordion
          title="FAAM 스포츠"
          scoreLabel={faamSportsScore != null ? `${faamSportsScore}%` : null}
          items={FAAM_SPORTS_ITEMS}
          answers={form.faamSportsAnswers}
          onAnswer={setFaamSportsAnswer}
          isOpen={openProm.has("faamSports")}
          toggleKey="faamSports"
          onToggle={togglePromOpen}
        />
      )}
      {visiblePromKeys.has("startback") && (
        <PromAccordion
          title="STarT Back (요통 위험군 분류)"
          scoreLabel={
            startBackScore != null ? `${startBackScore.total}/9 · ${startBackScore.riskLabel}` : null
          }
          items={STARTBACK_ITEMS}
          answers={form.startbackAnswers}
          onAnswer={setStartbackAnswer}
          isOpen={openProm.has("startback")}
          toggleKey="startback"
          onToggle={togglePromOpen}
        />
      )}

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1 mb-6 mt-3">
        <p>신나아짐 본점 T. 010-2496-8088</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-2496-8088)</p>
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
