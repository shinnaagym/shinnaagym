"use client";

import { memo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_OPTIONS,
  NRS_PAIN_OPTIONS,
  type FunctionalTestKey,
  type MovementDef,
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
  type PromItem,
} from "@/lib/prom-instruments";
import type { AssessmentMovements, ExercisePerformanceEntry, PainTriggerEntry } from "@/lib/db";

interface MovementEntry {
  romPassive: string;
  romActive: string;
  strength: string;
  painScale: string;
  compensation: string;
}

const EMPTY_ENTRY: MovementEntry = {
  romPassive: "",
  romActive: "",
  strength: "",
  painScale: "",
  compensation: "",
};

const EMPTY_FUNCTIONAL_NOTES: Record<FunctionalTestKey, string> = {
  core: "",
  squat: "",
  overheadSquat: "",
  pushup: "",
  hipHinge: "",
};

function inputClass(): string {
  return "w-full rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-coral";
}

interface PainTriggerFormEntry {
  note: string;
  painScale: number | null;
}

const PainTriggerRow = memo(function PainTriggerRow({
  index,
  entry,
  pastNotes,
  onChange,
  onRemove,
}: {
  index: number;
  entry: PainTriggerFormEntry;
  pastNotes: string[];
  onChange: (index: number, patch: Partial<PainTriggerFormEntry>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">동작 설명</label>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-coral hover:opacity-70"
        >
          삭제
        </button>
      </div>
      {pastNotes.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(index, { note: e.target.value });
          }}
          className={inputClass() + " bg-white mb-2"}
        >
          <option value="">이 회원의 과거 문구에서 선택</option>
          {pastNotes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <input
        value={entry.note}
        onChange={(e) => onChange(index, { note: e.target.value })}
        placeholder="예: 계단 내려갈 때 무릎 안쪽 통증"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">통증 척도 (NRS 0~10)</label>
      <div className="flex flex-wrap gap-1.5">
        {NRS_PAIN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(index, { painScale: Number(n) })}
            className={[
              "h-8 w-8 rounded-full border text-xs font-medium transition",
              entry.painScale === Number(n)
                ? "bg-coral text-white border-coral"
                : "border-line text-ink/60 hover:bg-bone",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
});

const ExercisePerformanceRow = memo(function ExercisePerformanceRow({
  index,
  entry,
  pastExercises,
  onChange,
  onRemove,
}: {
  index: number;
  entry: ExercisePerformanceEntry;
  pastExercises: string[];
  onChange: (index: number, patch: Partial<ExercisePerformanceEntry>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">운동</label>
        <button type="button" onClick={() => onRemove(index)} className="text-xs text-coral hover:opacity-70">
          삭제
        </button>
      </div>
      {pastExercises.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(index, { exercise: e.target.value });
          }}
          className={inputClass() + " bg-white mb-2"}
        >
          <option value="">이 회원의 과거 운동에서 선택</option>
          {pastExercises.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <input
        value={entry.exercise}
        onChange={(e) => onChange(index, { exercise: e.target.value })}
        placeholder="예: 한 발 점프"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">메모 (수행능력)</label>
      <input
        value={entry.note}
        onChange={(e) => onChange(index, { note: e.target.value })}
        placeholder="예: 60bpm으로 45회 수행 가능"
        className={inputClass()}
      />
    </div>
  );
});

const MovementRow = memo(function MovementRow({
  movement,
  entry,
  onChange,
}: {
  movement: MovementDef;
  entry: MovementEntry;
  onChange: (id: string, patch: Partial<MovementEntry>) => void;
}) {
  return (
    <div className="border-t border-line/50 px-3 py-3 sm:grid sm:grid-cols-[1fr_0.55fr_0.55fr_88px_88px_1.1fr] sm:items-center sm:gap-2 sm:py-2">
      <p className="text-sm font-medium mb-2 sm:mb-0">
        {movement.ko} <span className="text-xs text-ink/40">({movement.en})</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <input
          value={entry.romPassive}
          onChange={(e) => onChange(movement.id, { romPassive: e.target.value })}
          placeholder="가동범위(수동)"
          className={inputClass()}
        />
        <input
          value={entry.romActive}
          onChange={(e) => onChange(movement.id, { romActive: e.target.value })}
          placeholder="가동범위(능동)"
          className={inputClass()}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 sm:contents sm:mt-0">
        <select
          value={entry.strength}
          onChange={(e) => onChange(movement.id, { strength: e.target.value })}
          className={inputClass() + " bg-white"}
        >
          <option value="">근력</option>
          {MMT_STRENGTH_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={entry.painScale}
          onChange={(e) => onChange(movement.id, { painScale: e.target.value })}
          className={inputClass() + " bg-white"}
        >
          <option value="">통증</option>
          {NRS_PAIN_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <input
        value={entry.compensation}
        onChange={(e) => onChange(movement.id, { compensation: e.target.value })}
        placeholder="보상패턴 및 특이사항"
        className={inputClass() + " mt-2 sm:mt-0"}
      />
    </div>
  );
});

const PromItemRow = memo(function PromItemRow({
  item,
  value,
  onAnswer,
}: {
  item: PromItem;
  value: number | undefined;
  onAnswer: (key: string, value: number) => void;
}) {
  return (
    <div className="px-4 py-2.5 border-t border-line/50 first:border-t-0">
      <label className="block text-sm mb-1.5">{item.title}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onAnswer(item.key, Number(e.target.value))}
        className={inputClass() + " bg-white"}
      >
        <option value="" disabled>
          선택
        </option>
        {item.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});

const PromAccordion = memo(function PromAccordion({
  title,
  scoreLabel,
  items,
  answers,
  onAnswer,
  isOpen,
  toggleKey,
  onToggle,
}: {
  title: string;
  scoreLabel: string | null;
  items: readonly PromItem[];
  answers: Record<string, number>;
  onAnswer: (key: string, value: number) => void;
  isOpen: boolean;
  toggleKey: string;
  onToggle: (key: string) => void;
}) {
  return (
    <Accordion
      label={scoreLabel ? `${title} — ${scoreLabel}` : title}
      isOpen={isOpen}
      onToggle={() => onToggle(toggleKey)}
    >
      {items.map((item) => (
        <PromItemRow key={item.key} item={item} value={answers[item.key]} onAnswer={onAnswer} />
      ))}
    </Accordion>
  );
});

interface Criterion {
  label: string;
  value: string;
  status: "pass" | "fail" | "unknown";
}

function criterionIcon(status: Criterion["status"]): string {
  if (status === "pass") return "✅";
  if (status === "fail") return "⚠️";
  return "–";
}

function Accordion({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white overflow-hidden mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between px-4 py-3 text-left font-display text-base hover:bg-bone/40 transition"
      >
        <span>{label}</span>
        <span className="text-ink/40">{isOpen ? "▲" : "▼"}</span>
      </button>
      <div className={isOpen ? "block" : "hidden print:block"}>{children}</div>
    </div>
  );
}

export interface AssessmentInitialData {
  evaluatorName: string;
  evaluatedAt: string;
  movements: AssessmentMovements;
  coreNote: string;
  squatNote: string;
  overheadSquatNote: string;
  pushupNote: string;
  hipHingeNote: string;
  painTriggers: PainTriggerEntry[];
  exercisePerformance: ExercisePerformanceEntry[];
  odiAnswers: Record<string, number>;
  ndiAnswers: Record<string, number>;
  quickdashAnswers: Record<string, number>;
  koos12Answers: Record<string, number>;
  faamAdlAnswers: Record<string, number>;
  faamSportsAnswers: Record<string, number>;
  functionalTestPainFree: Record<string, boolean>;
  hopTestLsi: number | null;
  cmjLsi: number | null;
  hamstringLsi: number | null;
  asymptomaticLoadingWeeks: number | null;
  startbackAnswers: Record<string, number>;
}

export function AssessmentForm({
  memberId,
  memberName,
  pastPainTriggerNotes,
  pastExercises,
  assessmentId,
  initialData,
}: {
  memberId: number;
  memberName: string;
  pastPainTriggerNotes: string[];
  pastExercises: string[];
  assessmentId?: number;
  initialData?: AssessmentInitialData;
}) {
  const router = useRouter();
  const isEditing = assessmentId != null;
  const [evaluatorName, setEvaluatorName] = useState(initialData?.evaluatorName ?? "");
  const [evaluatedAt, setEvaluatedAt] = useState(
    () => initialData?.evaluatedAt || new Date().toISOString().slice(0, 10),
  );
  const [movements, setMovements] = useState<Record<string, MovementEntry>>(
    () => initialData?.movements ?? {},
  );
  const [openRegions, setOpenRegions] = useState<Set<string>>(() => new Set());
  const [functionalOpen, setFunctionalOpen] = useState(false);
  const [functionalNotes, setFunctionalNotes] = useState<Record<FunctionalTestKey, string>>(
    () =>
      initialData
        ? {
            core: initialData.coreNote,
            squat: initialData.squatNote,
            overheadSquat: initialData.overheadSquatNote,
            pushup: initialData.pushupNote,
            hipHinge: initialData.hipHingeNote,
          }
        : EMPTY_FUNCTIONAL_NOTES,
  );
  const [painTriggers, setPainTriggers] = useState<PainTriggerFormEntry[]>(
    () =>
      initialData && initialData.painTriggers.length > 0
        ? initialData.painTriggers
        : [{ note: "", painScale: null }],
  );
  const [exercisePerformance, setExercisePerformance] = useState<ExercisePerformanceEntry[]>(
    () =>
      initialData && initialData.exercisePerformance.length > 0
        ? initialData.exercisePerformance
        : [{ exercise: "", note: "" }],
  );
  const [odiAnswers, setOdiAnswers] = useState<Record<string, number>>(
    () => initialData?.odiAnswers ?? {},
  );
  const [ndiAnswers, setNdiAnswers] = useState<Record<string, number>>(
    () => initialData?.ndiAnswers ?? {},
  );
  const [quickdashAnswers, setQuickdashAnswers] = useState<Record<string, number>>(
    () => initialData?.quickdashAnswers ?? {},
  );
  const [koos12Answers, setKoos12Answers] = useState<Record<string, number>>(
    () => initialData?.koos12Answers ?? {},
  );
  const [faamAdlAnswers, setFaamAdlAnswers] = useState<Record<string, number>>(
    () => initialData?.faamAdlAnswers ?? {},
  );
  const [faamSportsAnswers, setFaamSportsAnswers] = useState<Record<string, number>>(
    () => initialData?.faamSportsAnswers ?? {},
  );
  const [functionalTestPainFree, setFunctionalTestPainFree] = useState<Record<string, boolean>>(
    () => initialData?.functionalTestPainFree ?? {},
  );
  const [hopTestLsi, setHopTestLsi] = useState<number | null>(initialData?.hopTestLsi ?? null);
  const [cmjLsi, setCmjLsi] = useState<number | null>(initialData?.cmjLsi ?? null);
  const [hamstringLsi, setHamstringLsi] = useState<number | null>(initialData?.hamstringLsi ?? null);
  const [asymptomaticLoadingWeeks, setAsymptomaticLoadingWeeks] = useState<number | null>(
    initialData?.asymptomaticLoadingWeeks ?? null,
  );
  const [startbackAnswers, setStartbackAnswers] = useState<Record<string, number>>(
    () => initialData?.startbackAnswers ?? {},
  );
  const [openExtra, setOpenExtra] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleExtra = useCallback((key: string) => {
    setOpenExtra((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setOdiAnswer = useCallback(
    (key: string, v: number) => setOdiAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setNdiAnswer = useCallback(
    (key: string, v: number) => setNdiAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setQuickdashAnswer = useCallback(
    (key: string, v: number) => setQuickdashAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setKoos12Answer = useCallback(
    (key: string, v: number) => setKoos12Answers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setFaamAdlAnswer = useCallback(
    (key: string, v: number) => setFaamAdlAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setFaamSportsAnswer = useCallback(
    (key: string, v: number) => setFaamSportsAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setStartbackAnswer = useCallback(
    (key: string, v: number) => setStartbackAnswers((prev) => ({ ...prev, [key]: v })),
    [],
  );

  const odiScore = computeOdiNdiScore(odiAnswers);
  const ndiScore = computeOdiNdiScore(ndiAnswers);
  const quickdashScore = computeQuickDashScore(quickdashAnswers);
  const koos12Score = computeKoos12Score(koos12Answers);
  const faamAdlScore = computeFaamScore(faamAdlAnswers);
  const faamSportsScore = computeFaamScore(faamSportsAnswers);
  const startBackScore = computeStartBackScore(startbackAnswers);

  const functionalTestsAllPainFree = FUNCTIONAL_TESTS.every((t) => functionalTestPainFree[t.key]);
  const functionalTestsPainFreeCount = FUNCTIONAL_TESTS.filter((t) => functionalTestPainFree[t.key]).length;

  const performanceCriteria: Criterion[] = [
    {
      label: "ODI(요추 기능장애) ≤ 20%",
      value: odiScore == null ? "미입력" : `${odiScore}%`,
      status: odiScore == null ? "unknown" : odiScore <= 20 ? "pass" : "fail",
    },
    {
      label: "NDI(경추 기능장애) ≤ 15%",
      value: ndiScore == null ? "미입력" : `${ndiScore}%`,
      status: ndiScore == null ? "unknown" : ndiScore <= 15 ? "pass" : "fail",
    },
    {
      label: "QuickDASH(상지 기능장애) ≤ 15",
      value: quickdashScore == null ? "미입력" : `${quickdashScore}`,
      status: quickdashScore == null ? "unknown" : quickdashScore <= 15 ? "pass" : "fail",
    },
    {
      label: "KOOS-12(무릎) ≥ 80",
      value: koos12Score == null ? "미입력" : `${koos12Score}`,
      status: koos12Score == null ? "unknown" : koos12Score >= 80 ? "pass" : "fail",
    },
    {
      label: "FAAM ADL(발·발목 일상) ≥ 90%",
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
      value: hopTestLsi == null ? "미입력" : `${hopTestLsi}%`,
      status: hopTestLsi == null ? "unknown" : hopTestLsi >= 90 ? "pass" : "fail",
    },
    {
      label: "CMJ(수직 점프) LSI ≥ 90%",
      value: cmjLsi == null ? "미입력" : `${cmjLsi}%`,
      status: cmjLsi == null ? "unknown" : cmjLsi >= 90 ? "pass" : "fail",
    },
    {
      label: "햄스트링 근력 LSI ≥ 90%",
      value: hamstringLsi == null ? "미입력" : `${hamstringLsi}%`,
      status: hamstringLsi == null ? "unknown" : hamstringLsi >= 90 ? "pass" : "fail",
    },
    {
      label: "무증상 점진 부하 유지 ≥ 4주",
      value: asymptomaticLoadingWeeks == null ? "미입력" : `${asymptomaticLoadingWeeks}주`,
      status:
        asymptomaticLoadingWeeks == null ? "unknown" : asymptomaticLoadingWeeks >= 4 ? "pass" : "fail",
    },
  ];
  const failedCriteria = performanceCriteria.filter((c) => c.status === "fail").length;
  const unknownCriteria = performanceCriteria.filter((c) => c.status === "unknown").length;
  const passedCriteria = performanceCriteria.length - failedCriteria - unknownCriteria;

  const toggleRegion = useCallback((key: string) => {
    setOpenRegions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const updateMovement = useCallback((id: string, patch: Partial<MovementEntry>) => {
    setMovements((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ENTRY), ...patch } }));
  }, []);

  const updatePainTrigger = useCallback((index: number, patch: Partial<PainTriggerFormEntry>) => {
    setPainTriggers((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }, []);

  function addPainTrigger() {
    setPainTriggers((prev) => [...prev, { note: "", painScale: null }]);
  }

  const removePainTrigger = useCallback((index: number) => {
    setPainTriggers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateExercisePerformance = useCallback(
    (index: number, patch: Partial<ExercisePerformanceEntry>) => {
      setExercisePerformance((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    },
    [],
  );

  function addExercisePerformance() {
    setExercisePerformance((prev) => [...prev, { exercise: "", note: "" }]);
  }

  const removeExercisePerformance = useCallback((index: number) => {
    setExercisePerformance((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const PROM_KEYS = ["odi", "ndi", "quickdash", "koos12", "faamAdl", "faamSports", "startback", "fitness"];

  function expandAll() {
    setOpenRegions(new Set(ASSESSMENT_REGIONS.map((r) => r.key)));
    setFunctionalOpen(true);
    setOpenExtra(new Set(PROM_KEYS));
  }

  function collapseAll() {
    setOpenRegions(new Set());
    setFunctionalOpen(false);
    setOpenExtra(new Set());
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const url = isEditing
        ? `/api/admin/members/${memberId}/assessments/${assessmentId}`
        : `/api/admin/members/${memberId}/assessments`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluatorName,
          evaluatedAt,
          movements,
          coreNote: functionalNotes.core,
          squatNote: functionalNotes.squat,
          overheadSquatNote: functionalNotes.overheadSquat,
          pushupNote: functionalNotes.pushup,
          hipHingeNote: functionalNotes.hipHinge,
          painTriggers,
          exercisePerformance,
          odiAnswers,
          ndiAnswers,
          quickdashAnswers,
          koos12Answers,
          faamAdlAnswers,
          faamSportsAnswers,
          functionalTestPainFree,
          hopTestLsi,
          cmjLsi,
          hamstringLsi,
          asymptomaticLoadingWeeks,
          startbackAnswers,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      router.push(
        isEditing
          ? `/admin/members/${memberId}/assessment/${assessmentId}`
          : `/admin/members/${memberId}/assessment`,
      );
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
          <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Assessment</p>
          <h1 className="font-display text-2xl">{isEditing ? "신체 평가지 수정" : "신체 평가지 작성"}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bone transition"
          >
            전체 펼치기
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bone transition"
          >
            전체 접기
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white px-5 py-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-ink/40 mb-1">회원 이름</p>
          <p className="font-medium">{memberName}</p>
        </div>
        <div>
          <label className="block text-xs text-ink/40 mb-1">평가일자</label>
          <input
            type="date"
            value={evaluatedAt}
            onChange={(e) => setEvaluatedAt(e.target.value)}
            className={inputClass()}
          />
        </div>
        <div>
          <label className="block text-xs text-ink/40 mb-1">담당 트레이너</label>
          <input
            value={evaluatorName}
            onChange={(e) => setEvaluatorName(e.target.value)}
            placeholder="이름 입력"
            className={inputClass()}
          />
        </div>
      </div>

      {ASSESSMENT_REGIONS.map((region) => (
        <Accordion
          key={region.key}
          label={region.label}
          isOpen={openRegions.has(region.key)}
          onToggle={() => toggleRegion(region.key)}
        >
          <div className="hidden sm:grid sm:grid-cols-[1fr_0.55fr_0.55fr_88px_88px_1.1fr] sm:gap-2 px-3 py-2 text-xs text-ink/40 border-t border-line/50 bg-bone/30">
            <span>동작</span>
            <span>가동범위(수동)</span>
            <span>가동범위(능동)</span>
            <span>근력</span>
            <span>통증척도</span>
            <span>보상패턴 및 특이사항</span>
          </div>
          {region.movements.map((movement) => (
            <MovementRow
              key={movement.id}
              movement={movement}
              entry={movements[movement.id] ?? EMPTY_ENTRY}
              onChange={updateMovement}
            />
          ))}
        </Accordion>
      ))}

      <Accordion
        label="기능적 움직임 검사"
        isOpen={functionalOpen}
        onToggle={() => setFunctionalOpen((v) => !v)}
      >
        <div className="divide-y divide-line/50">
          {FUNCTIONAL_TESTS.map((test) => (
            <div key={test.key} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">{test.label}</label>
                <label className="flex items-center gap-1.5 text-xs text-ink/60">
                  <input
                    type="checkbox"
                    checked={functionalTestPainFree[test.key] ?? false}
                    onChange={(e) =>
                      setFunctionalTestPainFree((prev) => ({ ...prev, [test.key]: e.target.checked }))
                    }
                  />
                  무통
                </label>
              </div>
              <textarea
                value={functionalNotes[test.key]}
                onChange={(e) =>
                  setFunctionalNotes((prev) => ({ ...prev, [test.key]: e.target.value }))
                }
                rows={2}
                placeholder="관찰 소견"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
              />
            </div>
          ))}
        </div>
      </Accordion>

      <div className="rounded-2xl border border-line bg-white px-5 py-5 mt-3 mb-8">
        <h2 className="font-display text-lg mb-3">통증 유발 동작</h2>
        <p className="text-xs text-ink/50 mb-3">
          회원마다 다른 동작(통증 나타나는 동작)이 여러 개면 하나씩 추가해주세요.
        </p>
        {painTriggers.map((entry, i) => (
          <PainTriggerRow
            key={i}
            index={i}
            entry={entry}
            pastNotes={pastPainTriggerNotes}
            onChange={updatePainTrigger}
            onRemove={removePainTrigger}
          />
        ))}
        <button
          type="button"
          onClick={addPainTrigger}
          className="rounded-full border border-coral text-coral px-4 py-2 text-sm font-medium hover:bg-coral/5 transition"
        >
          + 통증 유발 동작 추가
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-white px-5 py-5 mt-3 mb-8">
        <h2 className="font-display text-lg mb-3">운동 수행능력 평가</h2>
        <p className="text-xs text-ink/50 mb-3">
          운동별로 현재 수행 가능한 수준을 기록해주세요. 여러 개면 하나씩 추가해주세요.
        </p>
        {exercisePerformance.map((entry, i) => (
          <ExercisePerformanceRow
            key={i}
            index={i}
            entry={entry}
            pastExercises={pastExercises}
            onChange={updateExercisePerformance}
            onRemove={removeExercisePerformance}
          />
        ))}
        <button
          type="button"
          onClick={addExercisePerformance}
          className="rounded-full border border-coral text-coral px-4 py-2 text-sm font-medium hover:bg-coral/5 transition"
        >
          + 운동 수행능력 추가
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-white px-5 py-4 mt-3 mb-3">
        <h2 className="font-display text-lg mb-1">표준 설문(PROM)</h2>
        <p className="text-xs text-ink/50">
          해당 부위 문제가 있는 회원에게만 필요한 설문만 작성해주세요. 아래 문항은 공식 원문을 그대로
          옮긴 것이 아니라 이해하기 쉽게 재구성한 것으로, 점수는 참고용입니다.
        </p>
      </div>
      <PromAccordion
        title="ODI (요추 기능장애)"
        scoreLabel={odiScore != null ? `${odiScore}%` : null}
        items={ODI_ITEMS}
        answers={odiAnswers}
        onAnswer={setOdiAnswer}
        isOpen={openExtra.has("odi")}
        toggleKey="odi"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="NDI (경추 기능장애)"
        scoreLabel={ndiScore != null ? `${ndiScore}%` : null}
        items={NDI_ITEMS}
        answers={ndiAnswers}
        onAnswer={setNdiAnswer}
        isOpen={openExtra.has("ndi")}
        toggleKey="ndi"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="QuickDASH (상지 기능장애)"
        scoreLabel={quickdashScore != null ? `${quickdashScore}` : null}
        items={QUICKDASH_ITEMS}
        answers={quickdashAnswers}
        onAnswer={setQuickdashAnswer}
        isOpen={openExtra.has("quickdash")}
        toggleKey="quickdash"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="KOOS-12 (무릎)"
        scoreLabel={koos12Score != null ? `${koos12Score}` : null}
        items={KOOS12_ITEMS}
        answers={koos12Answers}
        onAnswer={setKoos12Answer}
        isOpen={openExtra.has("koos12")}
        toggleKey="koos12"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="FAAM ADL (발·발목 일상)"
        scoreLabel={faamAdlScore != null ? `${faamAdlScore}%` : null}
        items={FAAM_ADL_ITEMS}
        answers={faamAdlAnswers}
        onAnswer={setFaamAdlAnswer}
        isOpen={openExtra.has("faamAdl")}
        toggleKey="faamAdl"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="FAAM 스포츠"
        scoreLabel={faamSportsScore != null ? `${faamSportsScore}%` : null}
        items={FAAM_SPORTS_ITEMS}
        answers={faamSportsAnswers}
        onAnswer={setFaamSportsAnswer}
        isOpen={openExtra.has("faamSports")}
        toggleKey="faamSports"
        onToggle={toggleExtra}
      />
      <PromAccordion
        title="STarT Back (요통 위험군 분류)"
        scoreLabel={startBackScore != null ? `${startBackScore.total}/9 · ${startBackScore.riskLabel}` : null}
        items={STARTBACK_ITEMS}
        answers={startbackAnswers}
        onAnswer={setStartbackAnswer}
        isOpen={openExtra.has("startback")}
        toggleKey="startback"
        onToggle={toggleExtra}
      />

      <Accordion
        label="체력 테스트 · 부하 유지 기간"
        isOpen={openExtra.has("fitness")}
        onToggle={() => toggleExtra("fitness")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 py-4">
          <div>
            <label className="block text-xs text-ink/40 mb-1">홉 테스트 LSI (%)</label>
            <input
              type="number"
              value={hopTestLsi ?? ""}
              onChange={(e) => setHopTestLsi(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="예: 92"
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/40 mb-1">CMJ(수직 점프) LSI (%)</label>
            <input
              type="number"
              value={cmjLsi ?? ""}
              onChange={(e) => setCmjLsi(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="예: 92"
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/40 mb-1">햄스트링 근력 LSI (%)</label>
            <input
              type="number"
              value={hamstringLsi ?? ""}
              onChange={(e) => setHamstringLsi(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="예: 92"
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/40 mb-1">무증상 점진 부하 유지 기간(주)</label>
            <input
              type="number"
              value={asymptomaticLoadingWeeks ?? ""}
              onChange={(e) =>
                setAsymptomaticLoadingWeeks(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="예: 4"
              className={inputClass()}
            />
          </div>
        </div>
      </Accordion>

      <div className="rounded-2xl border border-line bg-white px-5 py-5 mt-3 mb-8">
        <h2 className="font-display text-lg mb-1">퍼포먼스 단계 전환 기준</h2>
        <p className="text-xs text-ink/50 mb-3">
          재활 단계에서 퍼포먼스(운동수행) 단계로 넘어가도 되는지 확인하는 체크리스트입니다. 미입력
          항목은 판단에서 제외됩니다.
        </p>
        <div
          className={[
            "rounded-xl px-4 py-2.5 text-sm font-medium mb-3",
            failedCriteria > 0
              ? "bg-coral/10 text-coral"
              : unknownCriteria > 0
                ? "bg-bone text-ink/60"
                : "bg-green-50 text-green-700",
          ].join(" ")}
        >
          {failedCriteria > 0
            ? `충족 ${passedCriteria} · 미충족 ${failedCriteria} · 미입력 ${unknownCriteria}`
            : unknownCriteria > 0
              ? `충족 ${passedCriteria} · 미입력 ${unknownCriteria} (전체 입력 시 재확인)`
              : "✅ 전환 기준 모두 충족"}
        </div>
        <ul className="divide-y divide-line/50">
          {performanceCriteria.map((c) => (
            <li key={c.label} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2">
                <span>{criterionIcon(c.status)}</span>
                {c.label}
              </span>
              <span className="text-ink/50">{c.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-coral mb-3 no-print">{error}</p>}

      <div className="flex gap-2 no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-line px-4 py-2.5 text-sm hover:bg-bone transition"
        >
          🖨️ 인쇄 / PDF 저장
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 rounded-full bg-ink text-white py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : isEditing ? "수정 저장하기" : "평가 저장하기"}
        </button>
      </div>
    </div>
  );
}
