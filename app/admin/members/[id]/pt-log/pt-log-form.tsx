"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import { PT_LOG_EQUIPMENT_OPTIONS, PT_LOG_SCALE_OPTIONS } from "@/lib/constants";

interface SetGroupInput {
  weight: string;
  reps: string;
  sets: string;
}

interface ExerciseInput {
  name: string;
  equipment: string;
  groups: SetGroupInput[];
}

function emptyGroup(): SetGroupInput {
  return { weight: "", reps: "", sets: "" };
}

function emptyExercise(): ExerciseInput {
  return { name: "", equipment: PT_LOG_EQUIPMENT_OPTIONS[0].value, groups: [emptyGroup()] };
}

export function PtLogForm({ memberId, memberName }: { memberId: number; memberName: string }) {
  const router = useRouter();
  const [logDate, setLogDate] = useState(() => koreaTodayKey());
  const [memo, setMemo] = useState("");
  const [painNote, setPainNote] = useState("");
  const [painScale, setPainScale] = useState("");
  const [exercises, setExercises] = useState<ExerciseInput[]>([emptyExercise()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateExercise(index: number, patch: Partial<ExerciseInput>) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function updateGroup(exIndex: number, groupIndex: number, patch: Partial<SetGroupInput>) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === exIndex
          ? { ...e, groups: e.groups.map((g, gi) => (gi === groupIndex ? { ...g, ...patch } : g)) }
          : e,
      ),
    );
  }

  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addGroup(exIndex: number) {
    setExercises((prev) =>
      prev.map((e, i) => (i === exIndex ? { ...e, groups: [...e.groups, emptyGroup()] } : e)),
    );
  }

  function removeGroup(exIndex: number, groupIndex: number) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === exIndex ? { ...e, groups: e.groups.filter((_, gi) => gi !== groupIndex) } : e,
      ),
    );
  }

  async function handleSubmit() {
    const cleanedExercises = exercises
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        name: e.name.trim(),
        equipment: e.equipment,
        groups: e.groups
          .filter((g) => g.weight !== "" || g.reps !== "" || g.sets !== "")
          .map((g) => ({
            weight: g.weight === "" ? null : Number(g.weight),
            reps: g.reps === "" ? null : Number(g.reps),
            sets: g.sets === "" ? null : Number(g.sets),
          })),
      }));

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/pt-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate,
          memo,
          painNote,
          painScale: painScale === "" ? null : Number(painScale),
          exercises: cleanedExercises,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "저장에 실패했어요.");
        return;
      }
      router.push(`/admin/members/${memberId}/pt-log`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">PT Log</p>
      <h1 className="font-display text-2xl mb-6">{memberName}님의 새 PT 일지</h1>

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">날짜</label>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="오늘 컨디션, 특이사항 등"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">통증 척도</label>
          <p className="text-xs text-ink/40 mb-1.5">
            평가 기록의 통증 척도 그래프에 같이 표시돼요.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={painNote}
              onChange={(e) => setPainNote(e.target.value)}
              placeholder="통증 부위 · 유발 동작 (예: 무릎, 오버헤드스쿼트)"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <select
              value={painScale}
              onChange={(e) => setPainScale(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            >
              <option value="">점수(0~10) 선택 안 함</option>
              {PT_LOG_SCALE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">운동수행 능력</p>
          <p className="text-xs text-ink/40">
            아래 운동 기록(무게·횟수)으로 자동 계산돼 평가 기록의 운동 수행능력 그래프(e1RM)에
            반영돼요. 따로 입력할 필요 없어요.
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {exercises.map((ex, exIndex) => (
          <div key={exIndex} className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <input
                value={ex.name}
                onChange={(e) => updateExercise(exIndex, { name: e.target.value })}
                placeholder="운동 이름 (예: 스쿼트)"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <select
                value={ex.equipment}
                onChange={(e) => updateExercise(exIndex, { equipment: e.target.value })}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              >
                {PT_LOG_EQUIPMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExercise(exIndex)}
                  className="text-ink/40 hover:text-coral text-sm shrink-0"
                  aria-label="운동 삭제"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-2">
              {ex.groups.map((g, groupIndex) => (
                <div key={groupIndex} className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={g.weight}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { weight: e.target.value })}
                    placeholder="무게(kg)"
                    className="w-24 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={g.reps}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { reps: e.target.value })}
                    placeholder="횟수"
                    className="w-20 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={g.sets}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { sets: e.target.value })}
                    placeholder="세트"
                    className="w-20 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  {ex.groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(exIndex, groupIndex)}
                      className="text-ink/40 hover:text-coral text-sm shrink-0"
                      aria-label="세트 그룹 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addGroup(exIndex)}
                className="text-xs text-coral hover:underline"
              >
                + 세트 그룹 추가 (같은 운동, 다른 무게)
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addExercise}
          className="w-full rounded-xl border border-dashed border-line px-4 py-2.5 text-sm text-ink/60 hover:border-coral/40 hover:text-coral transition"
        >
          + 운동 추가
        </button>
      </div>

      {error && <p className="text-sm text-coral mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-full border border-line py-2.5 text-sm hover:bg-bone transition"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 rounded-full bg-ink text-white py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
