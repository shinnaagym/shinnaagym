"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_OPTIONS,
  NRS_PAIN_OPTIONS,
  type FunctionalTestKey,
  type MovementDef,
} from "@/lib/assessment-movements";
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

function PainTriggerRow({
  entry,
  pastNotes,
  onChange,
  onRemove,
}: {
  entry: PainTriggerFormEntry;
  pastNotes: string[];
  onChange: (patch: Partial<PainTriggerFormEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">동작 설명</label>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-coral hover:opacity-70"
        >
          삭제
        </button>
      </div>
      {pastNotes.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange({ note: e.target.value });
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
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="예: 계단 내려갈 때 무릎 안쪽 통증"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">통증 척도 (NRS 0~10)</label>
      <div className="flex flex-wrap gap-1.5">
        {NRS_PAIN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ painScale: Number(n) })}
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
}

function ExercisePerformanceRow({
  entry,
  pastExercises,
  onChange,
  onRemove,
}: {
  entry: ExercisePerformanceEntry;
  pastExercises: string[];
  onChange: (patch: Partial<ExercisePerformanceEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">운동</label>
        <button type="button" onClick={onRemove} className="text-xs text-coral hover:opacity-70">
          삭제
        </button>
      </div>
      {pastExercises.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange({ exercise: e.target.value });
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
        onChange={(e) => onChange({ exercise: e.target.value })}
        placeholder="예: 한 발 점프"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">메모 (수행능력)</label>
      <input
        value={entry.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="예: 60bpm으로 45회 수행 가능"
        className={inputClass()}
      />
    </div>
  );
}

function MovementRow({
  movement,
  entry,
  onChange,
}: {
  movement: MovementDef;
  entry: MovementEntry;
  onChange: (patch: Partial<MovementEntry>) => void;
}) {
  return (
    <div className="border-t border-line/50 px-3 py-3 sm:grid sm:grid-cols-[1fr_0.55fr_0.55fr_88px_88px_1.1fr] sm:items-center sm:gap-2 sm:py-2">
      <p className="text-sm font-medium mb-2 sm:mb-0">
        {movement.ko} <span className="text-xs text-ink/40">({movement.en})</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <input
          value={entry.romPassive}
          onChange={(e) => onChange({ romPassive: e.target.value })}
          placeholder="가동범위(수동)"
          className={inputClass()}
        />
        <input
          value={entry.romActive}
          onChange={(e) => onChange({ romActive: e.target.value })}
          placeholder="가동범위(능동)"
          className={inputClass()}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 sm:contents sm:mt-0">
        <select
          value={entry.strength}
          onChange={(e) => onChange({ strength: e.target.value })}
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
          onChange={(e) => onChange({ painScale: e.target.value })}
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
        onChange={(e) => onChange({ compensation: e.target.value })}
        placeholder="보상패턴"
        className={inputClass() + " mt-2 sm:mt-0"}
      />
    </div>
  );
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
  const [openRegions, setOpenRegions] = useState<Set<string>>(
    () => new Set([ASSESSMENT_REGIONS[0].key]),
  );
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleRegion(key: string) {
    setOpenRegions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateMovement(id: string, patch: Partial<MovementEntry>) {
    setMovements((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ENTRY), ...patch } }));
  }

  function updatePainTrigger(index: number, patch: Partial<PainTriggerFormEntry>) {
    setPainTriggers((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function addPainTrigger() {
    setPainTriggers((prev) => [...prev, { note: "", painScale: null }]);
  }

  function removePainTrigger(index: number) {
    setPainTriggers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateExercisePerformance(index: number, patch: Partial<ExercisePerformanceEntry>) {
    setExercisePerformance((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function addExercisePerformance() {
    setExercisePerformance((prev) => [...prev, { exercise: "", note: "" }]);
  }

  function removeExercisePerformance(index: number) {
    setExercisePerformance((prev) => prev.filter((_, i) => i !== index));
  }

  function expandAll() {
    setOpenRegions(new Set(ASSESSMENT_REGIONS.map((r) => r.key)));
    setFunctionalOpen(true);
  }

  function collapseAll() {
    setOpenRegions(new Set());
    setFunctionalOpen(false);
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
            <span>보상패턴</span>
          </div>
          {region.movements.map((movement) => (
            <MovementRow
              key={movement.id}
              movement={movement}
              entry={movements[movement.id] ?? EMPTY_ENTRY}
              onChange={(patch) => updateMovement(movement.id, patch)}
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
              <label className="block text-sm font-medium mb-1.5">{test.label}</label>
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
            entry={entry}
            pastNotes={pastPainTriggerNotes}
            onChange={(patch) => updatePainTrigger(i, patch)}
            onRemove={() => removePainTrigger(i)}
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
            entry={entry}
            pastExercises={pastExercises}
            onChange={(patch) => updateExercisePerformance(i, patch)}
            onRemove={() => removeExercisePerformance(i)}
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
