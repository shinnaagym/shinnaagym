"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import { ExercisePerformanceRow } from "@/app/components/AssessmentEntryRows";
import type { ExercisePerformanceEntry } from "@/lib/db";

function emptyEntry(): ExercisePerformanceEntry {
  return { exercise: "", note: "", weight: null, reps: null, rpe: null };
}

// 평가 기록 작성 폼의 "운동 수행능력 평가" 섹션과 같은 입력을, PT 일지의
// 운동 수행능력(e1RM) 그래프 바로 아래에 상시 배치한 버전. 저장하면 평가
// 기록(assessments)에 그대로 쌓여 그래프에 반영된다.
export function ExercisePerformanceSection({
  memberId,
  pastExercises,
}: {
  memberId: number;
  pastExercises: string[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => koreaTodayKey());
  const [entries, setEntries] = useState<ExercisePerformanceEntry[]>([emptyEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateEntry(index: number, patch: Partial<ExercisePerformanceEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    setSaved(false);
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyEntry()]);
  }

  function removeEntry(index: number) {
    setEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    const valid = entries.filter(
      (e) => e.exercise.trim() || e.note.trim() || e.weight != null || e.reps != null,
    );
    if (valid.length === 0) {
      setError("운동을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluatedAt: date, exercisePerformance: valid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "저장에 실패했어요.");
        return;
      }
      setEntries([emptyEntry()]);
      setSaved(true);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-6">
      <h2 className="font-display text-base mb-1">운동 수행능력 평가</h2>
      <p className="text-xs text-ink/50 mb-3">
        운동별로 현재 수행 가능한 수준을 기록해주세요. 여러 개면 하나씩 추가해주세요.
      </p>
      <div className="mb-3">
        <label className="block text-xs text-ink/40 mb-1">날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
      </div>
      {entries.map((entry, i) => (
        <ExercisePerformanceRow
          key={i}
          index={i}
          entry={entry}
          pastExercises={pastExercises}
          onChange={updateEntry}
          onRemove={removeEntry}
        />
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={addEntry}
          className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-coral/40 transition"
        >
          + 운동 수행능력 추가
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded-full bg-coral text-white px-4 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
        {saved && <span className="text-xs text-sage">그래프에 반영됐어요.</span>}
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}
