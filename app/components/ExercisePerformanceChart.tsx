"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeE1rm } from "@/lib/exercise-performance";
import { koreaTodayKey } from "@/lib/date";
import type { AssessmentRow } from "@/lib/db";

const WIDTH = 640;
const HEIGHT = 180;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;
const MIN_RADIUS = 3.5;
const MAX_RADIUS = 9;
const LOW_RPE_COLOR = { r: 0x3f, g: 0xa7, b: 0x96 }; // sage — 가볍게 든 느낌
const HIGH_RPE_COLOR = { r: 0xe2, g: 0x73, b: 0x4f }; // coral — 최대 근접 느낌

function shortDateLabel(raw: string): string {
  const [, m, d] = raw.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : raw;
}

function createdAtMs(a: AssessmentRow): number {
  return new Date(a.created_at).getTime();
}

function dateKeyOf(a: AssessmentRow): string {
  if (a.evaluated_at) return a.evaluated_at;
  return new Date(a.created_at).toISOString().slice(0, 10);
}

interface ExercisePoint {
  dateKey: string;
  e1rm: number;
  weight: number;
  reps: number;
  rpe: number | null;
}

/** RPE 1~10을 반지름 3.5~9px로 선형 변환 — RPE가 높을수록(힘들수록) 점이 커진다. */
function radiusForRpe(rpe: number | null): number {
  if (rpe == null) return MIN_RADIUS;
  const t = Math.max(0, Math.min(1, (rpe - 1) / 9));
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

/** RPE 1~10을 sage(가벼움) → coral(최대 근접) 그라데이션 색으로 변환. */
function colorForRpe(rpe: number | null): string {
  if (rpe == null) return "#8a8578";
  const t = Math.max(0, Math.min(1, (rpe - 1) / 9));
  const r = Math.round(LOW_RPE_COLOR.r + (HIGH_RPE_COLOR.r - LOW_RPE_COLOR.r) * t);
  const g = Math.round(LOW_RPE_COLOR.g + (HIGH_RPE_COLOR.g - LOW_RPE_COLOR.g) * t);
  const b = Math.round(LOW_RPE_COLOR.b + (HIGH_RPE_COLOR.b - LOW_RPE_COLOR.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 평가지에 기록된 "운동 수행능력" 항목 중 무게·횟수가 모두 있는 탑세트만 골라
 * 운동 이름별로 묶는다. 같은 날짜에 같은 운동이 여러 건이면(같은 날 재평가 등)
 * 가장 나중에 작성된 값을 우선한다.
 */
function buildExerciseSeries(assessments: AssessmentRow[]): Map<string, ExercisePoint[]> {
  const sorted = [...assessments].sort((a, b) => createdAtMs(a) - createdAtMs(b));
  const byExercise = new Map<string, Map<string, ExercisePoint>>();

  for (const a of sorted) {
    const dateKey = dateKeyOf(a);
    for (const entry of a.exercise_performance) {
      const name = entry.exercise.trim();
      if (!name || entry.weight == null || entry.reps == null) continue;
      const e1rm = computeE1rm(entry.weight, entry.reps);
      if (e1rm == null) continue;
      const byDate = byExercise.get(name) ?? new Map<string, ExercisePoint>();
      byDate.set(dateKey, { dateKey, e1rm, weight: entry.weight, reps: entry.reps, rpe: entry.rpe });
      byExercise.set(name, byDate);
    }
  }

  const result = new Map<string, ExercisePoint[]>();
  for (const [name, byDate] of byExercise) {
    result.set(
      name,
      Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    );
  }
  return result;
}

/** 운동 하나의 차트 카드에 붙는 "빠른 기록 추가" 폼 — 관리자 화면에서 memberId가 있을 때만 노출된다. */
function QuickAddExerciseForm({ memberId, name, onDone }: { memberId: number; name: string; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(() => koreaTodayKey());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const weightNum = Number(weight);
    const repsNum = Number(reps);
    if (!weightNum || !repsNum) {
      setError("무게와 횟수를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluatedAt: date,
          exercisePerformance: [
            { exercise: name, note: "", weight: weightNum, reps: repsNum, rpe: rpe ? Number(rpe) : null },
          ],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "저장에 실패했어요.");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-line/50">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="무게(kg)"
          className="w-24 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="횟수"
          className="w-20 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <select
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        >
          <option value="">RPE(선택)</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-coral text-white px-4 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-coral/40 transition"
        >
          취소
        </button>
      </div>
      {error && <p className="text-sm text-coral mt-1.5">{error}</p>}
    </div>
  );
}

function SingleExerciseChart({
  name,
  points,
  memberId,
}: {
  name: string;
  points: ExercisePoint[];
  memberId?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const n = points.length;
  const values = points.map((p) => p.e1rm);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || rawMax * 0.2 || 10;
  const yMin = Math.max(0, rawMin - span * 0.2);
  const yMax = rawMax + span * 0.2;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - (v - yMin) / (yMax - yMin || 1));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.e1rm)} `).join("");

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const tooltipLeftPct = hoverIndex != null ? (xAt(hoverIndex) / WIDTH) * 100 : 0;

  const first = points[0];
  const last = points[points.length - 1];
  const trendUp = last.e1rm > first.e1rm;

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <style>{`
        @keyframes exercise-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-1 gap-2">
        <p className="font-display text-base">{name}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-ink/50 whitespace-nowrap">
            {first.e1rm}kg → <span className={trendUp ? "text-sage font-medium" : ""}>{last.e1rm}kg</span>{" "}
            (e1RM)
          </p>
          {memberId != null && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
            >
              + 기록추가
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-ink/40 mb-2">
        점 크기·색이 진할수록(코랄) 그날 힘들었던 세트, 연할수록(세이지) 가볍게 든 세트예요.
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="#e5e0d3"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 6} y={yAt(t) + 3} textAnchor="end" fontSize={9} fill="#8a8578">
                {Math.round(t)}
              </text>
            </g>
          ))}

          {points.map((p, i) => (
            <text
              key={i}
              x={xAt(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={9}
              fill="#8a8578"
            >
              {shortDateLabel(p.dateKey)}
            </text>
          ))}

          {hoverIndex != null && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#c3bda8"
              strokeWidth={1}
            />
          )}

          <path
            d={path}
            fill="none"
            stroke="#9c7238"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: "exercise-chart-draw 1.1s ease forwards",
            }}
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={xAt(i)}
              cy={yAt(p.e1rm)}
              r={radiusForRpe(p.rpe)}
              fill={colorForRpe(p.rpe)}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className="absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white shadow-md px-2.5 py-1.5 text-xs pointer-events-none w-max max-w-[200px]"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="text-ink/50 mb-0.5 whitespace-nowrap">{hovered.dateKey}</p>
            <p className="font-medium">e1RM {hovered.e1rm}kg</p>
            <p className="text-ink/60">
              {hovered.weight}kg × {hovered.reps}회
              {hovered.rpe != null && ` · RPE ${hovered.rpe}`}
            </p>
          </div>
        )}
      </div>

      {memberId != null && showAddForm && (
        <QuickAddExerciseForm memberId={memberId} name={name} onDone={() => setShowAddForm(false)} />
      )}
    </div>
  );
}

// 회원의 "운동 수행능력" 기록 중 무게·횟수가 있는 탑세트만 골라 운동 종목별로
// e1RM(추정 1RM) 추이를 꺾은선 그래프로 보여준다. 전문 지식 없이도 "선이
// 올라간다 = 강해지고 있다"만 보면 되도록 종목마다 그래프를 하나씩 분리해
// 단순하게 그린다. RPE는 점 크기와 색으로 표현해 "더 가벼운 느낌으로 더
// 무거운 무게를 든다"는 변화를 함께 보여준다.
export function ExercisePerformanceChart({
  assessments,
  memberId,
}: {
  assessments: AssessmentRow[];
  memberId?: number;
}) {
  const series = useMemo(() => buildExerciseSeries(assessments), [assessments]);
  const entries = Array.from(series.entries()).filter(([, points]) => points.length > 0);

  if (entries.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="font-display text-base mb-2">운동 수행능력 추이 (e1RM)</p>
      {entries.map(([name, points]) => (
        <SingleExerciseChart key={name} name={name} points={points} memberId={memberId} />
      ))}
    </div>
  );
}
