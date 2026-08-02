"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import { PT_LOG_EQUIPMENT_LABELS, PT_LOG_EQUIPMENT_OPTIONS } from "@/lib/constants";
import type { PastExerciseRecord } from "./past-exercise-names";

interface SetGroupInput {
  weight: string;
  reps: string;
  sets: string;
}

interface ExerciseInput {
  name: string;
  equipment: string;
  groups: SetGroupInput[];
  note: string;
}

function emptyGroup(): SetGroupInput {
  return { weight: "", reps: "", sets: "" };
}

function emptyExercise(): ExerciseInput {
  return {
    name: "",
    equipment: PT_LOG_EQUIPMENT_OPTIONS[0].value,
    groups: [emptyGroup()],
    note: "",
  };
}

export interface PtLogFormInitialData {
  logDate: string;
  memo: string;
  exercises: ExerciseInput[];
}

export function PtLogForm({
  memberId,
  memberName,
  ptLogId,
  initialData,
  pastExercises = [],
  pastExerciseGroups = {},
}: {
  memberId: number;
  memberName: string;
  ptLogId?: number;
  initialData?: PtLogFormInitialData;
  pastExercises?: string[];
  /** 운동 이름 -> 가장 최근에 그 운동을 했을 때의 도구·세트 그룹. 무게·횟수·세트
      입력란에 회색 placeholder("지난번엔 이랬다")로만 보여주고 값으로 채우진 않는다. */
  pastExerciseGroups?: Record<string, PastExerciseRecord>;
}) {
  const router = useRouter();
  const isEditing = ptLogId != null;
  const [logDate, setLogDate] = useState(() => initialData?.logDate ?? koreaTodayKey());
  const [memo, setMemo] = useState(() => initialData?.memo ?? "");
  const [exercises, setExercises] = useState<ExerciseInput[]>(
    () => initialData?.exercises ?? [emptyExercise()],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 이름 입력 중 자동완성 목록을 띄울 운동의 인덱스. 한 번에 한 칸만 연다.
  const [suggestIndex, setSuggestIndex] = useState<number | null>(null);

  function updateExercise(index: number, patch: Partial<ExerciseInput>) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  /** 운동 이름을 과거에 기록한 이름과 정확히 일치하게 바꾸면, 그때 세트 그룹이
      여러 개였을 경우 지금 칸에도 똑같은 개수만큼 빈 그룹을 미리 만들어둔다
      (값은 비운 채, placeholder로만 과거 기록을 보여줌). 이미 뭔가 입력해둔
      그룹이 있으면 건드리지 않는다. */
  function updateExerciseName(index: number, name: string) {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const past = pastExerciseGroups[name.trim()];
        const allEmpty = e.groups.every((g) => g.weight === "" && g.reps === "" && g.sets === "");
        if (past && allEmpty && past.groups.length > e.groups.length) {
          const groups = [...e.groups];
          while (groups.length < past.groups.length) groups.push(emptyGroup());
          return { ...e, name, groups };
        }
        return { ...e, name };
      }),
    );
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
        note: e.note.trim(),
      }));

    setSubmitting(true);
    setError(null);
    try {
      const url = isEditing
        ? `/api/admin/pt-logs/${ptLogId}`
        : `/api/admin/members/${memberId}/pt-logs`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate,
          memo,
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
      <h1 className="font-display text-2xl mb-6">
        {memberName}님의 {isEditing ? "PT 일지 수정" : "새 PT 일지"}
      </h1>

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">날짜</label>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="block w-full max-w-full box-border rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral appearance-none"
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
        <p className="text-xs text-ink/40">
          통증 척도·운동수행 능력은 PT 일지 목록의 그래프 아래 섹션에서 바로 남길 수 있어요.
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {exercises.map((ex, exIndex) => (
          <div key={exIndex} className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
            <div className="flex items-center mb-3 gap-2">
              <select
                value={ex.equipment}
                onChange={(e) => updateExercise(exIndex, { equipment: e.target.value })}
                className="w-24 shrink-0 rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none focus:border-coral"
              >
                {PT_LOG_EQUIPMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="relative min-w-0 flex-1">
                <input
                  value={ex.name}
                  onChange={(e) => updateExerciseName(exIndex, e.target.value)}
                  onFocus={() => setSuggestIndex(exIndex)}
                  onBlur={() => setTimeout(() => setSuggestIndex(null), 150)}
                  placeholder="운동 이름 (예: 스쿼트)"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
                />
                {suggestIndex === exIndex &&
                  ex.name.trim().length > 0 &&
                  (() => {
                    const query = ex.name.trim();
                    const matches = pastExercises
                      .filter((name) => name !== query && name.includes(query))
                      .slice(0, 6);
                    if (matches.length === 0) return null;
                    return (
                      <ul className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-line bg-white shadow-md overflow-hidden">
                        {matches.map((name) => (
                          <li key={name}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                updateExerciseName(exIndex, name);
                                setSuggestIndex(null);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-bone/60"
                            >
                              {name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
              </div>
              {exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExercise(exIndex)}
                  className="shrink-0 text-ink/40 hover:text-coral text-sm"
                  aria-label="운동 삭제"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-2">
              {ex.groups.map((g, groupIndex) => {
                const pastRecord = pastExerciseGroups[ex.name.trim()];
                const pastGroup = pastRecord?.groups[groupIndex];
                const weightPlaceholder =
                  pastGroup?.weight != null
                    ? `(${PT_LOG_EQUIPMENT_LABELS[pastRecord!.equipment] ?? pastRecord!.equipment}) ${pastGroup.weight}kg`
                    : "무게(kg)";
                return (
                <div key={groupIndex} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={g.weight}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { weight: e.target.value })}
                    placeholder={weightPlaceholder}
                    className="min-w-0 flex-[3] rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={g.reps}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { reps: e.target.value })}
                    placeholder={pastGroup?.reps != null ? String(pastGroup.reps) : "횟수"}
                    className="min-w-0 flex-[2] rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={g.sets}
                    onChange={(e) => updateGroup(exIndex, groupIndex, { sets: e.target.value })}
                    placeholder={pastGroup?.sets != null ? String(pastGroup.sets) : "세트"}
                    className="min-w-0 flex-[2] rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                  />
                  {ex.groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(exIndex, groupIndex)}
                      className="shrink-0 text-ink/40 hover:text-coral text-sm"
                      aria-label="세트 그룹 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
                );
              })}
              <button
                type="button"
                onClick={() => addGroup(exIndex)}
                className="text-xs text-coral hover:underline"
              >
                + 세트 그룹 추가 (같은 운동, 다른 무게)
              </button>
            </div>

            <input
              value={ex.note}
              onChange={(e) => updateExercise(exIndex, { note: e.target.value })}
              placeholder="특이사항 (예: 자세 보정, 통증 반응 등)"
              className="w-full mt-3 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
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
          {submitting ? "저장 중..." : isEditing ? "수정 저장" : "저장"}
        </button>
      </div>
    </div>
  );
}
