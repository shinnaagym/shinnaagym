"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import {
  PT_LOG_EQUIPMENT_LABELS,
  PT_LOG_EQUIPMENT_OPTIONS,
  PT_LOG_CIRCUIT_TYPE_OPTIONS,
  PT_LOG_CIRCUIT_TYPE_LABELS,
  PT_LOG_CIRCUIT_FIELD_CONFIG,
} from "@/lib/constants";
import { pastExerciseGroupKey, type PastCircuitEntry } from "./past-exercise-names";
import type { PtLogSetGroup } from "@/lib/db";

interface SetGroupInput {
  weight: string;
  reps: string;
  sets: string;
  /** 체크하면 이 세트의 무게·횟수·RPE를 운동 수행능력(e1RM) 그래프에도 반영한다. */
  trackPerformance: boolean;
  rpe: string;
}

interface CircuitInput {
  type: string;
  minutes: string;
  rounds: string;
  workout: string;
}

interface ExerciseInput {
  name: string;
  equipment: string;
  groups: SetGroupInput[];
  note: string;
  /** equipment가 "circuit"일 때만 쓴다. */
  circuit: CircuitInput | null;
  /** kind가 "personal_exercise"일 때만 쓰는 완료 체크. */
  done: boolean;
}

/** 무게·횟수 칸이 순수 숫자인지 확인한다 — 숫자면 "kg"/placeholder에 단위를
    붙이고, "밴드 3단계"처럼 자유 텍스트면 그대로 보여준다. 자유 텍스트 기능이
    생기기 전에 저장된 옛 기록은 weight/reps가 숫자로 남아있을 수 있어서,
    String()로 먼저 바꿔주지 않으면 .trim()이 없어 페이지가 깨진다. */
function isNumericText(s: string | number): boolean {
  return /^-?\d+(\.\d+)?$/.test(String(s).trim());
}

function emptyGroup(): SetGroupInput {
  return { weight: "", reps: "", sets: "", trackPerformance: false, rpe: "" };
}

function emptyCircuit(): CircuitInput {
  return { type: PT_LOG_CIRCUIT_TYPE_OPTIONS[0].value, minutes: "", rounds: "", workout: "" };
}

/** "과거 운동이력" 다이얼의 선택지 한 줄 미리보기. */
function circuitEntryPreview(
  circuit: PastCircuitEntry["circuit"],
  config: { showRounds: boolean },
): string {
  const parts: string[] = [];
  if (circuit.minutes != null) parts.push(`${circuit.minutes}분`);
  if (config.showRounds && circuit.rounds != null) parts.push(`${circuit.rounds}라운드`);
  if (circuit.workout) parts.push(circuit.workout.replace(/\s*\n\s*/g, " "));
  return parts.join(" · ") || "(내용 없음)";
}

function emptyExercise(): ExerciseInput {
  return {
    name: "",
    equipment: PT_LOG_EQUIPMENT_OPTIONS[0].value,
    groups: [emptyGroup()],
    note: "",
    circuit: null,
    done: false,
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
  pastCircuitEntries = {},
  kind = "pt_log",
  authToken,
}: {
  memberId: number;
  memberName: string;
  ptLogId?: number;
  initialData?: PtLogFormInitialData;
  pastExercises?: string[];
  /** (운동 이름, 도구) -> 가장 최근에 그 조합으로 했을 때의 세트 그룹. 무게·횟수·
      세트 입력란에 회색 placeholder("지난번엔 이랬다")로만 보여주고 값으로 채우진
      않는다. 도구가 다르면(바벨 스쿼트 vs 덤벨 스쿼트) 다른 운동으로 취급한다. */
  pastExerciseGroups?: Record<string, PtLogSetGroup[]>;
  /** 형식(AMRAP 등)별 과거 서킷 트레이닝 기록. "과거 운동이력" 다이얼에서 골라
      그대로 불러오는 용도. */
  pastCircuitEntries?: Record<string, PastCircuitEntry[]>;
  /** "pt_log"(기본, 코치용 PT 일지)면 세트마다 운동 수행능력(e1RM) 반영 체크박스가
      보이고, "personal_exercise"(회원 개인 운동)면 그 대신 운동마다 완료 체크박스가
      보인다. */
  kind?: "pt_log" | "personal_exercise";
  /** 회원 개인 페이지(/my/[token])에서 쓸 때만 넘긴다 — 관리자 인증 없이 토큰으로
      본인 개인 운동만 만들고 고칠 수 있는 /api/my/[token]/personal-exercises로
      요청을 보낸다. 관리자 화면에서 개인 운동을 대신 기록할 때는 넘기지 않는다. */
  authToken?: string;
}) {
  const router = useRouter();
  const isEditing = ptLogId != null;
  const kindLabel = kind === "personal_exercise" ? "개인 운동" : "PT 일지";
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

  /** 운동 이름·도구 조합이 과거에 기록한 조합과 정확히 일치하게 바뀌면, 그때
      세트 그룹이 여러 개였을 경우 지금 칸에도 똑같은 개수만큼 빈 그룹을 미리
      만들어둔다(값은 비운 채, placeholder로만 과거 기록을 보여줌). 이미 뭔가
      입력해둔 그룹이 있으면 건드리지 않는다. 이름·도구 둘 중 하나만 바뀌어도
      호출되므로, 바뀌지 않은 나머지 값은 patch에 넣지 않고 그대로 둔다. */
  function updateExerciseNameOrEquipment(index: number, patch: Partial<Pick<ExerciseInput, "name" | "equipment">>) {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const next = { ...e, ...patch };
        if (patch.equipment !== undefined) {
          // 서킷 트레이닝으로 바꾸면 형식 다이얼(AMRAP 등) 상태를 새로 만들고,
          // 서킷에서 다른 도구로 바꾸면 서킷 기록은 지운다.
          next.circuit = patch.equipment === "circuit" ? (e.circuit ?? emptyCircuit()) : null;
        }
        const past = pastExerciseGroups[pastExerciseGroupKey(next.name.trim(), next.equipment)];
        const allEmpty = next.groups.every((g) => g.weight === "" && g.reps === "" && g.sets === "");
        if (past && allEmpty && past.length > next.groups.length) {
          const groups = [...next.groups];
          while (groups.length < past.length) groups.push(emptyGroup());
          return { ...next, groups };
        }
        return next;
      }),
    );
  }

  function updateCircuit(exIndex: number, patch: Partial<CircuitInput>) {
    setExercises((prev) =>
      prev.map((e, i) => (i === exIndex && e.circuit ? { ...e, circuit: { ...e.circuit, ...patch } } : e)),
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
      .map((e) => {
        const done = kind === "personal_exercise" ? e.done : undefined;
        // 서킷 트레이닝은 이름을 직접 입력하지 않으므로 형식 이름(AMRAP 등)을
        // 이름으로 쓰고, 무게·횟수·세트 대신 circuit 기록을 담는다.
        if (e.equipment === "circuit" && e.circuit) {
          return {
            name: PT_LOG_CIRCUIT_TYPE_LABELS[e.circuit.type] ?? e.circuit.type,
            equipment: e.equipment,
            groups: [],
            note: e.note.trim(),
            done,
            circuit: {
              type: e.circuit.type,
              minutes: e.circuit.minutes === "" ? null : Number(e.circuit.minutes),
              rounds: e.circuit.rounds === "" ? null : Number(e.circuit.rounds),
              workout: e.circuit.workout.trim(),
            },
          };
        }
        return {
          name: e.name.trim(),
          equipment: e.equipment,
          groups: e.groups
            .filter((g) => g.weight !== "" || g.reps !== "" || g.sets !== "")
            .map((g) => ({
              weight: g.weight === "" ? null : g.weight.trim(),
              reps: g.reps === "" ? null : g.reps.trim(),
              sets: g.sets === "" ? null : Number(g.sets),
            })),
          note: e.note.trim(),
          done,
        };
      })
      .filter((e) => e.name.trim().length > 0);

    // 체크해둔 세트는 운동 수행능력(e1RM) 그래프용 평가 기록으로도 함께 남긴다.
    // 개인 운동에는 이 트래킹 UI 자체가 없다(코치가 감독하는 공식 기록만 반영).
    const performanceEntries =
      kind === "pt_log"
        ? exercises.flatMap((e) =>
            e.groups
              .filter(
                (g) =>
                  g.trackPerformance &&
                  g.rpe !== "" &&
                  (g.weight === "" || isNumericText(g.weight)) &&
                  (g.reps === "" || isNumericText(g.reps)),
              )
              .map((g) => ({
                exercise: e.name.trim(),
                note: "",
                weight: g.weight === "" ? null : Number(g.weight),
                reps: g.reps === "" ? null : Number(g.reps),
                rpe: Number(g.rpe),
              })),
          )
        : [];

    setSubmitting(true);
    setError(null);
    try {
      // 회원 개인 페이지(authToken 있음)에서는 토큰 인증 라우트로, 관리자
      // 화면에서는 관리자 라우트로 보낸다. PT 일지는 항상 관리자 전용이라
      // authToken이 있을 일이 없다.
      let url: string;
      if (authToken) {
        url = isEditing
          ? `/api/my/${authToken}/personal-exercises/${ptLogId}`
          : `/api/my/${authToken}/personal-exercises`;
      } else if (kind === "personal_exercise") {
        url = isEditing
          ? `/api/admin/personal-exercises/${ptLogId}`
          : `/api/admin/members/${memberId}/personal-exercises`;
      } else {
        url = isEditing
          ? `/api/admin/pt-logs/${ptLogId}`
          : `/api/admin/members/${memberId}/pt-logs`;
      }
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
      if (performanceEntries.length > 0) {
        await fetch(`/api/admin/members/${memberId}/assessments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evaluatedAt: logDate, exercisePerformance: performanceEntries }),
        });
      }
      const redirectHref = authToken
        ? `/my/${authToken}/personal-exercise`
        : `/admin/members/${memberId}/pt-log`;
      router.push(redirectHref);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">
        {kind === "personal_exercise" ? "Personal Exercise" : "PT Log"}
      </p>
      <h1 className="font-display text-2xl mb-6">
        {memberName}님의 {isEditing ? `${kindLabel} 수정` : `새 ${kindLabel}`}
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
        {kind === "pt_log" && (
          <p className="text-xs text-ink/40">
            통증 척도·운동수행 능력은 PT 일지 목록의 그래프 아래 섹션에서 바로 남길 수 있어요.
          </p>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {exercises.map((ex, exIndex) => (
          <div key={exIndex} className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
            <div className="flex items-center mb-3 gap-2">
              <select
                value={ex.equipment}
                onChange={(e) => updateExerciseNameOrEquipment(exIndex, { equipment: e.target.value })}
                className="w-32 shrink-0 rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none focus:border-coral"
              >
                {PT_LOG_EQUIPMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {ex.equipment === "circuit" ? (
                <select
                  value={ex.circuit?.type ?? PT_LOG_CIRCUIT_TYPE_OPTIONS[0].value}
                  onChange={(e) => updateCircuit(exIndex, { type: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
                >
                  {PT_LOG_CIRCUIT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}({o.description})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative min-w-0 flex-1">
                  <input
                    value={ex.name}
                    onChange={(e) => updateExerciseNameOrEquipment(exIndex, { name: e.target.value })}
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
                                  updateExerciseNameOrEquipment(exIndex, { name });
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
              )}
              {kind === "personal_exercise" && (
                <label className="flex items-center gap-1 shrink-0 text-xs text-ink/60 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={ex.done}
                    onChange={(e) => updateExercise(exIndex, { done: e.target.checked })}
                  />
                  완료
                </label>
              )}
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

            {ex.equipment === "circuit" && ex.circuit ? (
              (() => {
                const circuit = ex.circuit;
                const config = PT_LOG_CIRCUIT_FIELD_CONFIG[circuit.type] ?? PT_LOG_CIRCUIT_FIELD_CONFIG.amrap;
                const pastEntries = pastCircuitEntries[circuit.type] ?? [];
                return (
                  <div className="space-y-2">
                    {pastEntries.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const entry = pastEntries[Number(e.target.value)];
                          if (!entry) return;
                          updateCircuit(exIndex, {
                            minutes: entry.circuit.minutes == null ? "" : String(entry.circuit.minutes),
                            rounds: entry.circuit.rounds == null ? "" : String(entry.circuit.rounds),
                            workout: entry.circuit.workout,
                          });
                        }}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink/50 outline-none focus:border-coral"
                      >
                        <option value="" disabled>
                          과거 {PT_LOG_CIRCUIT_TYPE_LABELS[circuit.type] ?? ""} 운동이력 불러오기
                        </option>
                        {pastEntries.map((entry, i) => (
                          <option key={i} value={i}>
                            {entry.logDate} · {circuitEntryPreview(entry.circuit, config)}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={circuit.minutes}
                        onChange={(e) => updateCircuit(exIndex, { minutes: e.target.value })}
                        placeholder={config.minutesLabel}
                        className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                      />
                      {config.showRounds && (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={circuit.rounds}
                          onChange={(e) => updateCircuit(exIndex, { rounds: e.target.value })}
                          placeholder={config.roundsLabel}
                          className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                        />
                      )}
                    </div>
                    <textarea
                      value={circuit.workout}
                      onChange={(e) => updateCircuit(exIndex, { workout: e.target.value })}
                      rows={3}
                      placeholder="주어진 운동 (예: 스쿼트 10개, 버피 10개)"
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
                    />
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2">
                {ex.groups.map((g, groupIndex) => {
                  const pastGroups = pastExerciseGroups[pastExerciseGroupKey(ex.name.trim(), ex.equipment)];
                  const pastGroup = pastGroups?.[groupIndex];
                  const weightPlaceholder =
                    pastGroup?.weight != null
                      ? `(${PT_LOG_EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}) ${pastGroup.weight}${
                          isNumericText(pastGroup.weight) ? "kg" : ""
                        }`
                      : "kg / 변형 동작";
                  const repsPlaceholder =
                    pastGroup?.reps != null ? String(pastGroup.reps) : "횟수 / 시간(초)";
                  return (
                  <div key={groupIndex} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={g.weight}
                        onChange={(e) => updateGroup(exIndex, groupIndex, { weight: e.target.value })}
                        placeholder={weightPlaceholder}
                        className="min-w-0 flex-[3] rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-coral"
                      />
                      <input
                        type="text"
                        value={g.reps}
                        onChange={(e) => updateGroup(exIndex, groupIndex, { reps: e.target.value })}
                        placeholder={repsPlaceholder}
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
                      {kind === "pt_log" && (
                        <input
                          type="checkbox"
                          checked={g.trackPerformance}
                          onChange={(e) =>
                            updateGroup(exIndex, groupIndex, { trackPerformance: e.target.checked })
                          }
                          title="이 세트를 운동 수행능력(e1RM) 그래프에 반영"
                          className="shrink-0"
                        />
                      )}
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
                    {g.trackPerformance && (
                      <select
                        value={g.rpe}
                        onChange={(e) => updateGroup(exIndex, groupIndex, { rpe: e.target.value })}
                        className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-coral"
                      >
                        <option value="">RPE 선택 — 운동 수행능력 그래프에 반영돼요</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                          <option key={v} value={v}>
                            RPE {v}
                          </option>
                        ))}
                      </select>
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
            )}

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
