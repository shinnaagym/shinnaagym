"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import { appendSummaryToSvgClone, svgToPngDataUrl } from "@/lib/chart-image";
import type { PtLogRow } from "@/lib/db";
import { ChartZoomModal } from "@/app/components/ChartZoomModal";
import { DisclosureToggle } from "@/app/components/DisclosureToggle";

const WIDTH = 640;
const HEIGHT = 640;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
// 같은 날짜에 두 지표 값이 정확히 겹칠 때 서로 구분되도록 주는 픽셀 단위 간격.
const OVERLAP_JITTER_PX = 4;

interface SeriesDef {
  key: "weight" | "skeletalMuscleMass" | "bodyFatMass" | "bodyFatPercentage";
  label: string;
  unit: string;
  color: string;
}

const SERIES_DEFS: SeriesDef[] = [
  { key: "weight", label: "체중", unit: "kg", color: "#2a78d6" },
  { key: "skeletalMuscleMass", label: "골격근량", unit: "kg", color: "#3fa796" },
  { key: "bodyFatMass", label: "체지방량", unit: "kg", color: "#e2734f" },
  { key: "bodyFatPercentage", label: "체지방률", unit: "%", color: "#c9a227" },
];

interface DayGroup {
  dateKey: string;
  weight: number | null;
  skeletalMuscleMass: number | null;
  bodyFatMass: number | null;
  bodyFatPercentage: number | null;
}

interface Series {
  def: SeriesDef;
  values: (number | null)[];
}

function shortDateLabel(raw: string): string {
  const [, m, d] = raw.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : raw;
}

function createdAtMs(log: PtLogRow): number {
  return new Date(log.created_at).getTime();
}

/** PT 일지마다 따로 기록된 인바디 값을 날짜별로 묶는다. 같은 날짜에 여러 건이면
    (예: 운동 전·후 따로 기록) 지표마다 가장 나중에 작성된 값을 우선한다. */
function buildDayGroups(ptLogs: PtLogRow[]): DayGroup[] {
  const sorted = [...ptLogs].sort((a, b) => createdAtMs(a) - createdAtMs(b));
  const byDate = new Map<string, DayGroup>();
  for (const log of sorted) {
    const dateKey = log.log_date;
    const g = byDate.get(dateKey) ?? {
      dateKey,
      weight: null,
      skeletalMuscleMass: null,
      bodyFatMass: null,
      bodyFatPercentage: null,
    };
    if (log.inbody_weight != null) g.weight = log.inbody_weight;
    if (log.inbody_skeletal_muscle_mass != null) g.skeletalMuscleMass = log.inbody_skeletal_muscle_mass;
    if (log.inbody_body_fat_mass != null) g.bodyFatMass = log.inbody_body_fat_mass;
    if (log.inbody_body_fat_percentage != null) g.bodyFatPercentage = log.inbody_body_fat_percentage;
    byDate.set(dateKey, g);
  }
  return Array.from(byDate.values())
    .filter((g) => g.weight != null || g.skeletalMuscleMass != null || g.bodyFatMass != null || g.bodyFatPercentage != null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** 인바디 그래프에 붙는 "빠른 기록 추가" 폼 — 운동 기록 없이 인바디 측정값만 담은
    PT 일지를 하나 새로 만든다. */
function QuickAddInbodyForm({
  memberId,
  onDone,
}: {
  memberId: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => koreaTodayKey());
  const [weight, setWeight] = useState("");
  const [skeletalMuscleMass, setSkeletalMuscleMass] = useState("");
  const [bodyFatMass, setBodyFatMass] = useState("");
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!weight && !skeletalMuscleMass && !bodyFatMass && !bodyFatPercentage) {
      setError("값을 하나 이상 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/pt-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: date,
          inbody: {
            weight: weight === "" ? null : Number(weight),
            skeletalMuscleMass: skeletalMuscleMass === "" ? null : Number(skeletalMuscleMass),
            bodyFatMass: bodyFatMass === "" ? null : Number(bodyFatMass),
            bodyFatPercentage: bodyFatPercentage === "" ? null : Number(bodyFatPercentage),
          },
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
          placeholder="체중(kg)"
          className="w-24 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          inputMode="decimal"
          value={skeletalMuscleMass}
          onChange={(e) => setSkeletalMuscleMass(e.target.value)}
          placeholder="골격근량(kg)"
          className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          inputMode="decimal"
          value={bodyFatMass}
          onChange={(e) => setBodyFatMass(e.target.value)}
          placeholder="체지방량(kg)"
          className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          inputMode="decimal"
          value={bodyFatPercentage}
          onChange={(e) => setBodyFatPercentage(e.target.value)}
          placeholder="체지방률(%)"
          className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
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

// PT 일지에 함께 기록한 인바디(체중·골격근량·체지방량·체지방률)를 날짜별로 하나의
// 그래프에 겹쳐 보여준다. 운동 수행능력(e1RM) 그래프와 같은 구성 — 지표마다 선
// 색을 다르게 해 체성분 변화 추이를 한눈에 볼 수 있게 한다.
export function InbodyChart({
  ptLogs,
  memberId,
}: {
  ptLogs: PtLogRow[];
  memberId?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  async function handleZoom() {
    if (!svgRef.current) return;
    setZoomOpen(true);
    setZoomLoading(true);
    try {
      const exportSvg = appendSummaryToSvgClone(
        svgRef.current,
        summaryLines,
        series.map((s) => s.def.color),
        PAD_LEFT,
        WIDTH,
        HEIGHT,
      );
      const dataUrl = await svgToPngDataUrl(exportSvg);
      setZoomImage(dataUrl);
    } catch {
      setZoomOpen(false);
    } finally {
      setZoomLoading(false);
    }
  }

  const dayGroups = useMemo(() => buildDayGroups(ptLogs), [ptLogs]);

  if (dayGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="font-display text-base">인바디 그래프</p>
          <div className="flex items-center gap-2">
            {memberId != null && !showAddForm && expanded && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
              >
                + 기록추가
              </button>
            )}
            <DisclosureToggle
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
              label={expanded ? "인바디 그래프 접기" : "인바디 그래프 펼치기"}
            />
          </div>
        </div>
        {expanded && (
          <>
            {memberId != null && showAddForm ? (
              <QuickAddInbodyForm memberId={memberId} onDone={() => setShowAddForm(false)} />
            ) : (
              <p className="text-sm text-ink/40 text-center py-6">아직 기록된 인바디가 없어요.</p>
            )}
          </>
        )}
      </div>
    );
  }

  const dateLabels = dayGroups.map((g) => shortDateLabel(g.dateKey));
  const fullDates = dayGroups.map((g) => g.dateKey);

  const series: Series[] = SERIES_DEFS.map((def) => ({
    def,
    values: dayGroups.map((g) => g[def.key]),
  })).filter((s) => s.values.some((v) => v != null));

  const n = dayGroups.length;
  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || rawMax * 0.2 || 10;
  const yMin = Math.max(0, rawMin - span * 0.2);
  const yMax = rawMax + span * 0.2;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - (v - yMin) / (yMax - yMin || 1));

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  // 같은 날짜에 두 지표가 정확히 같은 값을 가지면 좌표가 겹치므로, 겹치는
  // 시리즈끼리 좌우 대칭으로 살짝 띄운 y좌표를 미리 계산해둔다.
  const yPixels: number[][] = series.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const groupsByValue = new Map<number, number[]>();
    series.forEach((s, si) => {
      const v = s.values[i];
      if (v == null) return;
      const seriesIdxs = groupsByValue.get(v) ?? [];
      seriesIdxs.push(si);
      groupsByValue.set(v, seriesIdxs);
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

  function summaryLineFor(s: Series): string {
    const points = s.values.filter((v): v is number => v != null);
    if (points.length === 0) return `${s.def.label} — 기록 없음`;
    const first = points[0];
    const last = points[points.length - 1];
    const trend = first === last ? `${last}${s.def.unit}` : `${first}${s.def.unit} → ${last}${s.def.unit}`;
    return `${s.def.label} — ${trend}`;
  }
  const summaryLines = series.map(summaryLineFor);

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
          .map((s) => ({ label: s.def.label, color: s.def.color, unit: s.def.unit, value: s.values[hoverIndex!] }))
          .filter((s): s is { label: string; color: string; unit: string; value: number } => s.value != null)
      : [];

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <style>{`
        @keyframes inbody-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="font-display text-base">인바디 그래프</p>
        <div className="flex items-center gap-2">
          {memberId != null && !showAddForm && expanded && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
            >
              + 기록추가
            </button>
          )}
          <DisclosureToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            label={expanded ? "인바디 그래프 접기" : "인바디 그래프 펼치기"}
          />
        </div>
      </div>

      {expanded && (
        <>
          {memberId != null && showAddForm && (
            <QuickAddInbodyForm memberId={memberId} onDone={() => setShowAddForm(false)} />
          )}

          <div className="flex items-center gap-x-4 gap-y-1.5 mb-2 text-xs text-ink/60 flex-wrap">
            {series.map((s) => {
              const points = s.values.filter((v): v is number => v != null);
              const first = points[0];
              const last = points[points.length - 1];
              const showChange = first != null && last != null && first !== last;
              return (
                <span key={s.def.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4" style={{ backgroundColor: s.def.color }} />
                  {s.def.label}
                  {showChange && (
                    <span className="text-ink/50">
                      {first}
                      {s.def.unit} →{" "}
                      <span className={last < first ? "text-sage font-medium" : "text-ink/60"}>
                        {last}
                        {s.def.unit}
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
                <g key={s.def.key}>
                  <path
                    d={pathFor(si)}
                    fill="none"
                    stroke={s.def.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    style={{
                      strokeDasharray: 1,
                      strokeDashoffset: 1,
                      animation: "inbody-chart-draw 1.1s ease forwards",
                      animationDelay: `${si * 0.15}s`,
                    }}
                  />
                  {s.values.map(
                    (v, i) =>
                      v != null && (
                        <g key={i}>
                          <circle
                            cx={xAt(i)}
                            cy={yPixels[si][i]}
                            r={4}
                            fill={s.def.color}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                          <text
                            x={xAt(i)}
                            y={yPixels[si][i] - 8}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight={600}
                            fill={s.def.color}
                          >
                            {v}
                            {s.def.unit}
                          </text>
                        </g>
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
                  <p key={h.label} className="leading-snug break-words">
                    <span className="font-medium" style={{ color: h.color }}>
                      {h.value}
                      {h.unit}
                    </span>
                    <span className="text-ink/50"> {h.label}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ChartZoomModal
        open={zoomOpen}
        title="인바디 그래프"
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
