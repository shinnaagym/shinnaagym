import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_LABELS,
} from "@/lib/assessment-movements";
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
import { computeE1rm } from "@/lib/exercise-performance";
import type { AssessmentMovements, ExercisePerformanceEntry, PainTriggerEntry } from "@/lib/db";

export interface AssessmentDocumentData {
  evaluator_name: string;
  evaluated_at: string;
  movements: AssessmentMovements;
  core_note: string;
  squat_note: string;
  overhead_squat_note: string;
  pushup_note: string;
  hip_hinge_note: string;
  painTriggers: PainTriggerEntry[];
  exercisePerformance: ExercisePerformanceEntry[];
  odi_answers: Record<string, number>;
  ndi_answers: Record<string, number>;
  quickdash_answers: Record<string, number>;
  koos12_answers: Record<string, number>;
  faam_adl_answers: Record<string, number>;
  faam_sports_answers: Record<string, number>;
  nprs_rest: number | null;
  nprs_activity: number | null;
  functional_test_pain_free: Record<string, boolean>;
  hop_test_lsi: number | null;
  cmj_lsi: number | null;
  hamstring_lsi: number | null;
  asymptomatic_loading_weeks: number | null;
  startback_answers: Record<string, number>;
}

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

function criterionIcon(status: "pass" | "fail" | "unknown"): string {
  if (status === "pass") return "✅";
  if (status === "fail") return "⚠️";
  return "–";
}

type NoteField =
  | "core_note"
  | "squat_note"
  | "overhead_squat_note"
  | "pushup_note"
  | "hip_hinge_note";

const FUNCTIONAL_NOTE_FIELDS: Record<string, NoteField> = {
  core: "core_note",
  squat: "squat_note",
  overheadSquat: "overhead_squat_note",
  pushup: "pushup_note",
  hipHinge: "hip_hinge_note",
};

// 회원 개인 계약서 페이지와 같은 결의 읽기 전용 렌더러 — 관리자의 평가 상세보기
// 페이지(과거 평가 이력 조회)에서 쓰인다. 55개 동작 전부를 부위별로 나열해
// 종이 평가지와 동일한 구조로 보여주고, 입력 없는 항목은 "-"로 표시한다.
export function AssessmentDocument({
  memberName,
  assessment,
}: {
  memberName: string;
  assessment: AssessmentDocumentData;
}) {
  const odiScore = computeOdiNdiScore(assessment.odi_answers);
  const ndiScore = computeOdiNdiScore(assessment.ndi_answers);
  const quickdashScore = computeQuickDashScore(assessment.quickdash_answers);
  const koos12Score = computeKoos12Score(assessment.koos12_answers);
  const faamAdlScore = computeFaamScore(assessment.faam_adl_answers);
  const faamSportsScore = computeFaamScore(assessment.faam_sports_answers);
  const startBackScore = computeStartBackScore(assessment.startback_answers);

  const promSummaries: PromSummary[] = [
    promSummary("ODI (요추 기능장애)", ODI_ITEMS, assessment.odi_answers, odiScore, "%"),
    promSummary("NDI (경추 기능장애)", NDI_ITEMS, assessment.ndi_answers, ndiScore, "%"),
    promSummary("QuickDASH (상지 기능장애)", QUICKDASH_ITEMS, assessment.quickdash_answers, quickdashScore, ""),
    promSummary("KOOS-12 (무릎)", KOOS12_ITEMS, assessment.koos12_answers, koos12Score, ""),
    promSummary("FAAM ADL (발·발목 일상)", FAAM_ADL_ITEMS, assessment.faam_adl_answers, faamAdlScore, "%"),
    promSummary("FAAM 스포츠", FAAM_SPORTS_ITEMS, assessment.faam_sports_answers, faamSportsScore, "%"),
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

  const functionalTestsPainFreeCount = FUNCTIONAL_TESTS.filter(
    (t) => assessment.functional_test_pain_free[t.key],
  ).length;
  const functionalTestsAllPainFree = FUNCTIONAL_TESTS.every(
    (t) => assessment.functional_test_pain_free[t.key],
  );

  const performanceCriteria: { label: string; value: string; status: "pass" | "fail" | "unknown" }[] = [
    {
      label: "ODI ≤ 20%",
      value: odiScore == null ? "미입력" : `${odiScore}%`,
      status: odiScore == null ? "unknown" : odiScore <= 20 ? "pass" : "fail",
    },
    {
      label: "NDI ≤ 15%",
      value: ndiScore == null ? "미입력" : `${ndiScore}%`,
      status: ndiScore == null ? "unknown" : ndiScore <= 15 ? "pass" : "fail",
    },
    {
      label: "QuickDASH ≤ 15",
      value: quickdashScore == null ? "미입력" : `${quickdashScore}`,
      status: quickdashScore == null ? "unknown" : quickdashScore <= 15 ? "pass" : "fail",
    },
    {
      label: "KOOS-12 ≥ 80",
      value: koos12Score == null ? "미입력" : `${koos12Score}`,
      status: koos12Score == null ? "unknown" : koos12Score >= 80 ? "pass" : "fail",
    },
    {
      label: "FAAM ADL ≥ 90%",
      value: faamAdlScore == null ? "미입력" : `${faamAdlScore}%`,
      status: faamAdlScore == null ? "unknown" : faamAdlScore >= 90 ? "pass" : "fail",
    },
    {
      label: "FAAM 스포츠 ≥ 80%",
      value: faamSportsScore == null ? "미입력" : `${faamSportsScore}%`,
      status: faamSportsScore == null ? "unknown" : faamSportsScore >= 80 ? "pass" : "fail",
    },
    {
      label: "STarT Back 총점 ≤ 3",
      value: startBackScore == null ? "미입력" : `${startBackScore.total}점`,
      status: startBackScore == null ? "unknown" : startBackScore.total <= 3 ? "pass" : "fail",
    },
    {
      label: "기능적 움직임 검사 5개 모두 무통",
      value: `${functionalTestsPainFreeCount}/${FUNCTIONAL_TESTS.length}`,
      status: functionalTestsPainFreeCount === 0 ? "unknown" : functionalTestsAllPainFree ? "pass" : "fail",
    },
    {
      label: "홉 테스트 LSI ≥ 90%",
      value: assessment.hop_test_lsi == null ? "미입력" : `${assessment.hop_test_lsi}%`,
      status:
        assessment.hop_test_lsi == null ? "unknown" : assessment.hop_test_lsi >= 90 ? "pass" : "fail",
    },
    {
      label: "CMJ(수직 점프) LSI ≥ 90%",
      value: assessment.cmj_lsi == null ? "미입력" : `${assessment.cmj_lsi}%`,
      status: assessment.cmj_lsi == null ? "unknown" : assessment.cmj_lsi >= 90 ? "pass" : "fail",
    },
    {
      label: "햄스트링 근력 LSI ≥ 90%",
      value: assessment.hamstring_lsi == null ? "미입력" : `${assessment.hamstring_lsi}%`,
      status:
        assessment.hamstring_lsi == null ? "unknown" : assessment.hamstring_lsi >= 90 ? "pass" : "fail",
    },
    {
      label: "무증상 점진 부하 유지 ≥ 4주",
      value:
        assessment.asymptomatic_loading_weeks == null
          ? "미입력"
          : `${assessment.asymptomatic_loading_weeks}주`,
      status:
        assessment.asymptomatic_loading_weeks == null
          ? "unknown"
          : assessment.asymptomatic_loading_weeks >= 4
            ? "pass"
            : "fail",
    },
  ];

  return (
    <>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Assessment</p>
      <h1 className="font-display text-3xl mb-1">신체 평가지</h1>
      <p className="text-xs text-ink/50 mb-4">
        회원 {memberName} · 평가일 {assessment.evaluated_at || "-"} · 담당 트레이너{" "}
        {assessment.evaluator_name || "-"}
      </p>

      <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 text-xs text-ink/60 leading-relaxed mb-8">
        <p className="font-medium text-ink mb-1">민감정보 처리 안내</p>
        <p>
          이 평가지에는 건강상태, 병력, 통증 부위·통증 척도 등 「개인정보 보호법」상 민감정보가
          포함되어 있습니다. 해당 정보는 회원가입 계약서 제4조(민감정보 수집·이용 동의)에 따라
          별도 동의를 받은 정보이며, 오직 회원 맞춤형 운동 프로그램 설계 목적으로만 사용됩니다.
        </p>
      </div>

      {ASSESSMENT_REGIONS.map((region) => (
        <section key={region.key} className="mb-8">
          <h2 className="font-display text-lg mb-3">{region.label}</h2>
          <div className="rounded-2xl border border-line overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[640px]">
              <thead>
                <tr className="bg-bone/60 text-left text-ink/50">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">동작</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">가동범위(수동)</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">가동범위(능동)</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">근력</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">통증척도</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">보상패턴 및 특이사항</th>
                </tr>
              </thead>
              <tbody>
                {region.movements.map((movement) => {
                  const entry = assessment.movements[movement.id];
                  return (
                    <tr key={movement.id} className="border-t border-line/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {movement.ko}
                        <span className="text-ink/40"> ({movement.en})</span>
                      </td>
                      <td className="px-3 py-2 text-ink/70">{entry?.romPassive || "-"}</td>
                      <td className="px-3 py-2 text-ink/70">{entry?.romActive || "-"}</td>
                      <td className="px-3 py-2 text-ink/70">
                        {entry?.strength ? MMT_STRENGTH_LABELS[entry.strength] ?? entry.strength : "-"}
                      </td>
                      <td className="px-3 py-2 text-ink/70">
                        {entry?.painPassive || entry?.painActive ? (
                          <>
                            {entry?.painPassive && <span>수동 {entry.painPassive}/10</span>}
                            {entry?.painPassive && entry?.painActive && <span>, </span>}
                            {entry?.painActive && <span>능동 {entry.painActive}/10</span>}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink/70">{entry?.compensation || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">기능적 움직임 검사</h2>
        <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
          {FUNCTIONAL_TESTS.map((test) => (
            <div key={test.key} className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">{test.label}</p>
              <p>{assessment[FUNCTIONAL_NOTE_FIELDS[test.key]] || "-"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">통증 유발 동작</h2>
        {assessment.painTriggers.length === 0 ? (
          <div className="rounded-2xl border border-line px-4 py-4 text-sm text-ink/50">-</div>
        ) : (
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
            {assessment.painTriggers.map((entry, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <p>{entry.note || "-"}</p>
                <p className="font-display text-lg whitespace-nowrap">
                  {entry.painScale != null ? `${entry.painScale} / 10` : "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">운동 수행능력 평가</h2>
        {assessment.exercisePerformance.length === 0 ? (
          <div className="rounded-2xl border border-line px-4 py-4 text-sm text-ink/50">-</div>
        ) : (
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
            {assessment.exercisePerformance.map((entry, i) => {
              const e1rm = computeE1rm(entry.weight, entry.reps);
              return (
                <div key={i} className="px-4 py-3">
                  <p className="font-medium text-ink">{entry.exercise || "-"}</p>
                  {entry.note && <p className="text-ink/70">{entry.note}</p>}
                  {entry.weight != null && entry.reps != null && (
                    <p className="text-ink/60 text-xs mt-1">
                      탑세트 {entry.weight}kg × {entry.reps}회
                      {entry.rpe != null && ` · RPE ${entry.rpe}`}
                      {e1rm != null && ` · e1RM ${e1rm}kg`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(assessment.nprs_rest != null || assessment.nprs_activity != null) && (
        <section className="mb-8">
          <h2 className="font-display text-lg mb-3">NRS 통증 척도</h2>
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm sm:divide-y-0 sm:grid sm:grid-cols-2">
            <div className="px-4 py-3 sm:border-r sm:border-line/60">
              <p className="text-xs text-ink/40 mb-0.5">안정 시</p>
              <p>{assessment.nprs_rest != null ? `${assessment.nprs_rest} / 10` : "-"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">활동 중</p>
              <p>{assessment.nprs_activity != null ? `${assessment.nprs_activity} / 10` : "-"}</p>
            </div>
          </div>
        </section>
      )}

      {promSummaries.length > 0 && (
        <section className="mb-8">
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

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">퍼포먼스 단계 전환 기준</h2>
        <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
          {performanceCriteria.map((c) => (
            <div key={c.label} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span>{criterionIcon(c.status)}</span>
                {c.label}
              </span>
              <span className="text-ink/50">{c.value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1">
        <p>신나아짐 본점 T. 010-6859-6114</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-6859-6114)</p>
      </div>
    </>
  );
}
