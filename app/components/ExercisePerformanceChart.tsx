"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { computeE1rm } from "@/lib/exercise-performance";
import { koreaTodayKey } from "@/lib/date";
import { svgToPngDataUrl } from "@/lib/chart-image";
import type { AssessmentRow } from "@/lib/db";
import { ChartZoomModal } from "@/app/components/ChartZoomModal";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
// 같은 날짜에 여러 운동의 e1RM이 정확히 겹칠 때 서로 구분되도록 주는 픽셀 단위 간격.
const OVERLAP_JITTER_PX = 4;

// 통증 척도 그래프와 동일한 팔레트 — 운동 종목별 시리즈에 순서대로 배정한다.
const SERIES_COLORS = [
  "#9c7238",
  "#2a78d6",
  "#3fa796",
  "#e2734f",
  "#a35fd1",
  "#c9a227",
  "#d1477a",
  "#5f8fd1",
  "#7fae4d",
  "#7a6fd6",
];

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
  e1rm: number;
  weight: number;
  reps: number;
  rpe: number | null;
}

interface DayGroup {
  dateKey: string;
  byExercise: Record<string, ExercisePoint>;
}

interface Series {
  name: string;
  color: string;
  values: (ExercisePoint | null)[];
}

/**
 * 평가지에 기록된 "운동 수행능력" 항목 중 무게·횟수가 모두 있는 탑세트만 골라
 * 날짜별로 묶는다. 같은 날짜에 같은 운동이 여러 건이면(같은 날 재평가 등)
 * 가장 나중에 작성된 값을 우선한다.
 */
function buildDayGroups(assessments: AssessmentRow[]): DayGroup[] {
  const sorted = [...assessments].sort((a, b) => createdAtMs(a) - createdAtMs(b));
  const byDate = new Map<string, Record<string, ExercisePoint>>();

  for (const a of sorted) {
    const dateKey = dateKeyOf(a);
    const byExercise = byDate.get(dateKey) ?? {};
    for (const entry of a.exercise_performance) {
      const name = entry.exercise.trim();
      if (!name || entry.weight == null || entry.reps == null) continue;
      const e1rm = computeE1rm(entry.weight, entry.reps);
      if (e1rm == null) continue;
      byExercise[name] = { e1rm, weight: entry.weight, reps: entry.reps, rpe: entry.rpe };
    }
    byDate.set(dateKey, byExercise);
  }

  return Array.from(byDate.entries())
    .map(([dateKey, byExercise]) => ({ dateKey, byExercise }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** 운동 수행능력 그래프에 붙는 "빠른 기록 추가" 폼 — 이미 추적 중인 운동 중 하나를 골라 오늘 날짜의 기록만 새로 남긴다. */
function QuickAddExerciseForm({
  memberId,
  exerciseNames,
  onDone,
}: {
  memberId: number;
  exerciseNames: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(exerciseNames[0] ?? "");
  const [date, setDate] = useState(() => koreaTodayKey());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const weightNum = Number(weight);
    const repsNum = Number(reps);
    if (!name || !weightNum || !repsNum) {
      setError("운동, 무게, 횟수를 입력해주세요.");
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
    <div className="mb-3 pb-3 border-b border-line/50">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral max-w-[160px]"
        >
          {exerciseNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
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

// 회원의 "운동 수행능력" 기록 중 무게·횟수가 있는 탑세트만 골라 종목별
// e1RM(추정 1RM)을 하나의 그래프에 겹쳐서 보여준다. 통증 척도 그래프와 같은
// 방식으로, 종목마다 선 색을 다르게 해 "선이 올라간다 = 강해지고 있다"를
// 한눈에 비교할 수 있게 한다.
export function ExercisePerformanceChart({
  assessments,
  memberId,
}: {
  assessments: AssessmentRow[];
  memberId?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  async function handleZoom() {
    if (!svgRef.current) return;
    setZoomOpen(true);
    setZoomLoading(true);
    try {
      const dataUrl = await svgToPngDataUrl(svgRef.current);
      setZoomImage(dataUrl);
    } catch {
      setZoomOpen(false);
    } finally {
      setZoomLoading(false);
    }
  }

  const dayGroups = useMemo(() => buildDayGroups(assessments), [assessments]);

  const exerciseNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const g of dayGroups) {
      for (const name of Object.keys(g.byExercise)) {
        if (!seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
    }
    return names;
  }, [dayGroups]);

  if (dayGroups.length === 0 || exerciseNames.length === 0) return null;

  const dateLabels = dayGroups.map((g) => shortDateLabel(g.dateKey));
  const fullDates = dayGroups.map((g) => g.dateKey);

  const series: Series[] = exerciseNames.map((name, i) => ({
    name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    values: dayGroups.map((g) => g.byExercise[name] ?? null),
  }));

  const n = dayGroups.length;
  const allValues = series.flatMap((s) => s.values).filter((v): v is ExercisePoint => v != null);
  const rawMin = Math.min(...allValues.map((v) => v.e1rm));
  const rawMax = Math.max(...allValues.map((v) => v.e1rm));
  const span = rawMax - rawMin || rawMax * 0.2 || 10;
  const yMin = Math.max(0, rawMin - span * 0.2);
  const yMax = rawMax + span * 0.2;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - (v - yMin) / (yMax - yMin || 1));

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  // 같은 날짜에 두 개 이상의 시리즈가 정확히 같은 e1RM을 가지면 좌표가 완전히
  // 겹치므로, 겹치는 시리즈끼리 좌우 대칭으로 살짝 띄운 y좌표를 미리 계산해둔다.
  const yPixels: number[][] = series.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const groupsByValue = new Map<number, number[]>();
    series.forEach((s, si) => {
      const v = s.values[i];
      if (v == null) return;
      const seriesIdxs = groupsByValue.get(v.e1rm) ?? [];
      seriesIdxs.push(si);
      groupsByValue.set(v.e1rm, seriesIdxs);
    });
    for (const [value, seriesIdxs] of groupsByValue) {
      const baseY = yAt(value);
      const count = seriesIdxs.length;
      seriesIdxs.forEach((si, k) => {
        yPixels[si][i] = baseY + (k - (count - 1) / 2) * OVERLAP_JITTER_PX;
      });
    }
  }

  function pathFor(si: number): string {
    let d = "";
    let started = false;
    series[si].values.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? "L" : "M"}${xAt(i)},${yPixels[si][i]} `;
      started = true;
    });
    return d.trim();
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    dateLabels.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const tooltipLeftPct = hoverIndex != null ? (xAt(hoverIndex) / WIDTH) * 100 : 0;
  const hoveredValues =
    hoverIndex != null
      ? series
          .map((s) => ({ name: s.name, color: s.color, value: s.values[hoverIndex!] }))
          .filter((s): s is { name: string; color: string; value: ExercisePoint } => s.value != null)
      : [];

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <style>{`
        @keyframes exercise-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="font-display text-base">운동 수행능력 그래프 (e1RM)</p>
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

      {memberId != null && showAddForm && (
        <QuickAddExerciseForm
          memberId={memberId}
          exerciseNames={exerciseNames}
          onDone={() => setShowAddForm(false)}
        />
      )}

      <div className="flex items-center gap-x-4 gap-y-1.5 mb-2 text-xs text-ink/60 flex-wrap">
        {series.map((s) => {
          const points = s.values.filter((v): v is ExercisePoint => v != null);
          const first = points[0];
          const last = points[points.length - 1];
          const showChange = first != null && last != null && first !== last;
          return (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: s.color }} />
              {s.name}
              {showChange && (
                <span className="text-ink/50">
                  {first.e1rm}kg →{" "}
                  <span
                    className={last.e1rm > first.e1rm ? "text-sage font-medium" : "text-ink/60"}
                  >
                    {last.e1rm}kg
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="relative cursor-zoom-in" onClick={handleZoom} title="탭하여 확대 · 이미지 저장">
        <svg
          ref={svgRef}
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

          {dateLabels.map((label, i) => (
            <text key={i} x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fill="#8a8578">
              {label}
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

          {series.map((s, si) => (
            <g key={s.name}>
              <path
                d={pathFor(si)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: 1,
                  animation: "exercise-chart-draw 1.1s ease forwards",
                  animationDelay: `${si * 0.15}s`,
                }}
              />
              {s.values.map(
                (v, i) =>
                  v != null && (
                    <circle
                      key={i}
                      cx={xAt(i)}
                      cy={yPixels[si][i]}
                      r={4}
                      fill={s.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ),
              )}
            </g>
          ))}
        </svg>

        {hoverIndex != null && hoveredValues.length > 0 && (
          <div
            className="absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white shadow-md px-2.5 py-1.5 text-xs pointer-events-none w-max max-w-[220px]"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="text-ink/50 mb-0.5 whitespace-nowrap">{fullDates[hoverIndex]}</p>
            {hoveredValues.map((h) => (
              <p key={h.name} className="leading-snug break-words">
                <span className="font-medium" style={{ color: h.color }}>
                  {h.value.e1rm}kg
                </span>
                <span className="text-ink/50">
                  {" "}
                  {h.name} · {h.value.weight}kg × {h.value.reps}회
                  {h.value.rpe != null && ` · RPE ${h.value.rpe}`}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ChartZoomModal
        open={zoomOpen}
        title="운동 수행능력 그래프 (e1RM)"
        imageUrl={zoomImage}
        loading={zoomLoading}
        onClose={() => {
          setZoomOpen(false);
          setZoomImage(null);
        }}
      />
    </div>
  );
}
