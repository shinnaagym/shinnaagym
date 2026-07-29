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
import type { IntakeQuestionnaireRow } from "@/lib/db";

interface PromSummary {
  title: string;
  score: number | null;
  unit: string;
  answeredCount: number;
  totalCount: number;
}

function promSummary(
  title: string,
  items: readonly { key: string }[],
  answers: Record<string, number>,
  score: number | null,
  unit: string,
): PromSummary {
  return {
    title,
    score,
    unit,
    answeredCount: items.filter((i) => typeof answers[i.key] === "number").length,
    totalCount: items.length,
  };
}

function labelOf(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label || "-";
}

function keyLabelOf(options: readonly { key: string; label: string }[], key: string): string {
  return options.find((o) => o.key === key)?.label || "-";
}

function labelsOf(options: readonly { key: string; label: string }[], keys: string[]): string {
  if (keys.length === 0) return "-";
  return keys.map((k) => keyLabelOf(options, k)).join(", ");
}

function cycleDirectionLabel(value: string): string {
  if (value === "up") return "▲ 심해짐";
  if (value === "down") return "▼ 나아짐";
  return "-";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs text-ink/40 mb-1">{label}</p>
      <p className="text-sm text-ink/80 whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-5 mb-4">
      <h2 className="font-display text-lg mb-4">{title}</h2>
      {children}
    </section>
  );
}

// 회원 개인 페이지(내 정보 확인용)와 관리자 상세보기에서 함께 쓰는 초진
// 문진표 읽기 전용 렌더러. 입력 컨트롤이 전혀 없어 어디서 렌더링하든 수정이
// 불가능하다.
export function IntakeDocument({
  memberName,
  intake,
}: {
  memberName: string;
  intake: IntakeQuestionnaireRow;
}) {
  const visitChannelDetail =
    intake.visit_channel === "referral" && intake.visit_channel_referrer_name
      ? ` (${intake.visit_channel_referrer_name})`
      : intake.visit_channel === "other" && intake.visit_channel_other
        ? ` (${intake.visit_channel_other})`
        : "";

  const odiScore = computeOdiNdiScore(intake.odi_answers);
  const ndiScore = computeOdiNdiScore(intake.ndi_answers);
  const quickdashScore = computeQuickDashScore(intake.quickdash_answers);
  const koos12Score = computeKoos12Score(intake.koos12_answers);
  const faamAdlScore = computeFaamScore(intake.faam_adl_answers);
  const faamSportsScore = computeFaamScore(intake.faam_sports_answers);
  const startBackScore = computeStartBackScore(intake.startback_answers);

  const promSummaries: PromSummary[] = [
    promSummary("ODI (요추 기능장애)", ODI_ITEMS, intake.odi_answers, odiScore, "%"),
    promSummary("NDI (경추 기능장애)", NDI_ITEMS, intake.ndi_answers, ndiScore, "%"),
    promSummary("QuickDASH (상지 기능장애)", QUICKDASH_ITEMS, intake.quickdash_answers, quickdashScore, ""),
    promSummary("KOOS-12 (무릎)", KOOS12_ITEMS, intake.koos12_answers, koos12Score, ""),
    promSummary("FAAM ADL (발·발목 일상)", FAAM_ADL_ITEMS, intake.faam_adl_answers, faamAdlScore, "%"),
    promSummary("FAAM 스포츠", FAAM_SPORTS_ITEMS, intake.faam_sports_answers, faamSportsScore, "%"),
  ].filter((s) => s.answeredCount > 0);
  if (startBackScore) {
    promSummaries.push({
      title: "STarT Back (요통 위험군)",
      score: startBackScore.total,
      unit: `/9 · ${startBackScore.riskLabel}`,
      answeredCount: STARTBACK_ITEMS.length,
      totalCount: STARTBACK_ITEMS.length,
    });
  }

  return (
    <>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Intake</p>
      <h1 className="font-display text-3xl mb-4">초진 문진표</h1>

      <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 text-xs text-ink/60 leading-relaxed mb-6">
        <p className="font-medium text-ink mb-1">민감정보 처리 안내</p>
        <p>
          이 문진표에는 통증·수면·스트레스·음주/흡연 등 「개인정보 보호법」상 민감정보가
          포함되어 있습니다. 해당 정보는 회원가입 계약서 제4조(민감정보 수집·이용 동의)에 따라
          별도 동의를 받은 정보이며, 오직 회원 맞춤형 운동 프로그램 설계 목적으로만 사용됩니다.
        </p>
      </div>

      <Section title="기본정보">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Field label="이름">{intake.intake_name || memberName}</Field>
          <Field label="나이">{intake.age != null ? `${intake.age}세` : "-"}</Field>
          <Field label="연락처">{intake.phone || "-"}</Field>
        </div>
        <Field label="'신나아짐'에 오게 된 경로">
          {labelOf(VISIT_CHANNEL_OPTIONS, intake.visit_channel)}
          {visitChannelDetail}
        </Field>
        <Field label="운동 목적">
          {labelsOf(EXERCISE_PURPOSE_OPTIONS, intake.exercise_purposes)}
          {intake.exercise_purpose_other && ` · ${intake.exercise_purpose_other}`}
        </Field>
      </Section>

      <Section title="통증의 발생 과정 (MOI)">
        <Field label="서술">{intake.pain_moi || "-"}</Field>
      </Section>

      <Section title="통증의 발생">
        <Field label="기간">{intake.pain_onset_period || "-"}</Field>
        <Field label="양상">{labelOf(PAIN_ONSET_TYPE_OPTIONS, intake.pain_onset_type)}</Field>
      </Section>

      <Section title="통증의 강도 (NRS)">
        {intake.pain_movements.length === 0 ? (
          <p className="text-sm text-ink/40">-</p>
        ) : (
          <div className="space-y-3">
            {intake.pain_movements.map((entry, i) => (
              <div key={i} className="rounded-xl border border-line/60 px-3 py-3 text-sm">
                <p className="font-medium mb-1">{entry.movement || "-"}</p>
                <p className="text-ink/60 text-xs">
                  좋을 때 {entry.nrsBest ?? "-"} · 나쁠 때 {entry.nrsWorst ?? "-"} · 현재{" "}
                  {entry.nrsCurrent ?? "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="통증의 주기">
        <Field label="상황">{intake.pain_cycle_situation || "-"}</Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PAIN_CYCLE_PERIODS.map((period) => {
            const key = (
              {
                morning: "pain_cycle_morning",
                noon: "pain_cycle_noon",
                evening: "pain_cycle_evening",
                night: "pain_cycle_night",
              } as const
            )[period.key];
            return (
              <div key={period.key} className="text-sm">
                <span className="text-ink/50 mr-2">{period.label}</span>
                {cycleDirectionLabel(intake[key])}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="통증의 특징">
        <Field label="해당 특징">{labelsOf(PAIN_CHARACTERISTIC_OPTIONS, intake.pain_characteristics)}</Field>
        {intake.pain_characteristics_other && (
          <Field label="기타">{intake.pain_characteristics_other}</Field>
        )}
      </Section>

      <Section title="생활습관">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="짝다리">{labelOf(STANCE_LEG_OPTIONS, intake.stance_leg)}</Field>
          <Field label="다리꼬기">{labelOf(LEG_CROSS_OPTIONS, intake.leg_cross)}</Field>
          <Field label="자는 자세">{labelOf(SLEEP_POSITION_OPTIONS, intake.sleep_position)}</Field>
          <Field label="수면 시간">
            {intake.sleep_hours != null ? `${intake.sleep_hours}시간` : "-"}
          </Field>
          <Field label="수면 질">{labelOf(SLEEP_QUALITY_OPTIONS, intake.sleep_quality)}</Field>
          <Field label="스트레스">{labelOf(STRESS_LEVEL_OPTIONS, intake.stress_level)}</Field>
          <Field label="음주 및 흡연">
            {[intake.drinking && "음주", intake.smoking && "흡연"].filter(Boolean).join(", ") || "없음"}
          </Field>
        </div>
        <Field label="자주 하는 동작">{intake.frequent_movement || "-"}</Field>
        <Field label="다른 특이사항">{intake.other_notes || "-"}</Field>
      </Section>

      <Section title="통증의 양상">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="좋아지는 경우">{intake.improve_factors || "-"}</Field>
          <Field label="나빠지는 경우">{intake.worsen_factors || "-"}</Field>
        </div>
      </Section>

      <Section title="병력 및 대처">
        <Field label="환자가 생각하는 통증의 원인">{intake.perceived_cause || "-"}</Field>
        <Field label="통증 발생 후 대처">{intake.post_pain_action || "-"}</Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="동일 통증 과거력">{intake.past_same_pain_history || "-"}</Field>
          <Field label="과거 치료 내용">{intake.past_treatment || "-"}</Field>
        </div>
      </Section>

      <Section title="주요 호소(부위)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="1순위">{intake.major_complaint || "-"}</Field>
          <Field label="2순위">{intake.minor_complaint || "-"}</Field>
        </div>
      </Section>

      {promSummaries.length > 0 && (
        <section className="mb-4">
          <h2 className="font-display text-lg mb-3">표준 설문(PROM)</h2>
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
            {promSummaries.map((s) => (
              <div key={s.title} className="px-4 py-3 flex items-center justify-between gap-3">
                <p>{s.title}</p>
                <p className="font-display text-lg whitespace-nowrap">
                  {s.score != null ? `${s.score}${s.unit}` : `응답 ${s.answeredCount}/${s.totalCount}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1">
        <p>신나아짐 본점 T. 010-6859-6114</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-6859-6114)</p>
      </div>
    </>
  );
}
