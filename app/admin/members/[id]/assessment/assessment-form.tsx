"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_OPTIONS,
  type FunctionalTestKey,
  type MovementDef,
} from "@/lib/assessment-movements";

interface MovementEntry {
  romPassive: string;
  romActive: string;
  strength: string;
  compensation: string;
}

const EMPTY_ENTRY: MovementEntry = { romPassive: "", romActive: "", strength: "", compensation: "" };

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
    <div className="border-t border-line/50 px-3 py-3 sm:grid sm:grid-cols-[1.1fr_0.85fr_0.85fr_110px_1.2fr] sm:items-center sm:gap-2 sm:py-2">
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
        <input
          value={entry.compensation}
          onChange={(e) => onChange({ compensation: e.target.value })}
          placeholder="보상패턴"
          className={inputClass()}
        />
      </div>
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

export function AssessmentForm({
  memberId,
  memberName,
}: {
  memberId: number;
  memberName: string;
}) {
  const router = useRouter();
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatedAt, setEvaluatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [movements, setMovements] = useState<Record<string, MovementEntry>>({});
  const [openRegions, setOpenRegions] = useState<Set<string>>(
    () => new Set([ASSESSMENT_REGIONS[0].key]),
  );
  const [functionalOpen, setFunctionalOpen] = useState(false);
  const [functionalNotes, setFunctionalNotes] =
    useState<Record<FunctionalTestKey, string>>(EMPTY_FUNCTIONAL_NOTES);
  const [painTriggerNote, setPainTriggerNote] = useState("");
  const [painScale, setPainScale] = useState<number | null>(null);
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
      const res = await fetch(`/api/admin/members/${memberId}/assessments`, {
        method: "POST",
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
          painTriggerNote,
          painScale,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      router.push(`/admin/members/${memberId}/assessment`);
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
          <h1 className="font-display text-2xl">신체 평가지 작성</h1>
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
          <div className="hidden sm:grid sm:grid-cols-[1.1fr_0.85fr_0.85fr_110px_1.2fr] sm:gap-2 px-3 py-2 text-xs text-ink/40 border-t border-line/50 bg-bone/30">
            <span>동작</span>
            <span>가동범위(수동)</span>
            <span>가동범위(능동)</span>
            <span>근력</span>
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
        <label className="block text-sm font-medium mb-1.5">
          회원마다 다른 동작(통증 나타나는 동작)
        </label>
        <textarea
          value={painTriggerNote}
          onChange={(e) => setPainTriggerNote(e.target.value)}
          rows={2}
          placeholder="예: 계단 내려갈 때 무릎 안쪽 통증"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none mb-4"
        />
        <label className="block text-sm font-medium mb-2">통증 척도 (NRS 0~10)</label>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPainScale(n)}
              className={[
                "h-9 w-9 rounded-full border text-sm font-medium transition",
                painScale === n ? "bg-coral text-white border-coral" : "border-line text-ink/60 hover:bg-bone",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
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
          {submitting ? "저장 중..." : "평가 저장하기"}
        </button>
      </div>
    </div>
  );
}
