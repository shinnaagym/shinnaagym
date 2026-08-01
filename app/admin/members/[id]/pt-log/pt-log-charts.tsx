"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { koreaTodayKey } from "@/lib/date";
import { svgToPngDataUrl } from "@/lib/chart-image";
import { PT_LOG_SCALE_OPTIONS } from "@/lib/constants";
import type { PtLogRow } from "@/lib/db";
import { ChartZoomModal } from "@/app/components/ChartZoomModal";

const WIDTH = 640;
const HEIGHT = 180;
const PAD_LEFT = 28;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function shortDateLabel(raw: string): string {
  const [, m, d] = raw.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : raw;
}

function createdAtMs(a: PtLogRow): number {
  return new Date(a.created_at).getTime();
}

type ScaleField = "pain_scale" | "performance_scale";

interface DayPoint {
  dateKey: string;
  value: number;
}

// 같은 날짜에 여러 건(빠른 기록 + 상세 일지 등)이 있으면 가장 나중에 작성된
// 값을 우선한다 — 평가 기록의 통증 척도 그래프와 같은 방식. 값이 없는 날짜는
// (단일 시리즈라) 아예 그래프에서 제외한다.
function buildPoints(ptLogs: PtLogRow[], field: ScaleField): DayPoint[] {
  const byDate = new Map<string, PtLogRow[]>();
  for (const log of ptLogs) {
    const list = byDate.get(log.log_date) ?? [];
    list.push(log);
    byDate.set(log.log_date, list);
  }
  const points: DayPoint[] = [];
  for (const [dateKey, list] of byDate) {
    const sorted = [...list].sort((a, b) => createdAtMs(a) - createdAtMs(b));
    let value: number | null = null;
    for (const l of sorted) {
      if (l[field] != null) value = l[field];
    }
    if (value != null) points.push({ dateKey, value });
  }
  return points.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** 그래프에 붙는 "빠른 기록 추가" 폼 — 운동 목록 없이 오늘 날짜의 점수만 새로 남긴다. */
function QuickAddScoreForm({
  memberId,
  field,
  onDone,
}: {
  memberId: number;
  field: ScaleField;
  onDone: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => koreaTodayKey());
  const [scale, setScale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (scale === "") {
      setError("점수를 선택해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const bodyKey = field === "pain_scale" ? "painScale" : "performanceScale";
      const res = await fetch(`/api/admin/members/${memberId}/pt-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logDate: date, [bodyKey]: Number(scale) }),
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
        <select
          value={scale}
          onChange={(e) => setScale(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        >
          <option value="">점수(0~10)</option>
          {PT_LOG_SCALE_OPTIONS.map((v) => (
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

export function PtLogScoreChart({
  title,
  ptLogs,
  field,
  memberId,
  color,
}: {
  title: string;
  ptLogs: PtLogRow[];
  field: ScaleField;
  memberId: number;
  color: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const points = useMemo(() => buildPoints(ptLogs, field), [ptLogs, field]);

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

  const n = points.length;
  const dateLabels = points.map((p) => shortDateLabel(p.dateKey));
  const fullDates = points.map((p) => p.dateKey);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - v / 10);
  const gridTicks = [0, 2, 4, 6, 8, 10];

  function pathFor(): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.value)}`).join(" ");
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

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <style>{`
        @keyframes pt-log-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="font-display text-base">{title}</p>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
          >
            + 기록추가
          </button>
        )}
      </div>

      {showAddForm && (
        <QuickAddScoreForm memberId={memberId} field={field} onDone={() => setShowAddForm(false)} />
      )}

      {points.length === 0 ? (
        <p className="text-sm text-ink/40 py-6 text-center">아직 기록이 없어요.</p>
      ) : (
        <div className="relative cursor-zoom-in" onClick={handleZoom} title="탭하여 확대 · 이미지 저장">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {gridTicks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  stroke="#e5e0d3"
                  strokeWidth={1}
                />
                <text x={PAD_LEFT - 6} y={yAt(t) + 3} textAnchor="end" fontSize={9} fill="#8a8578">
                  {t}
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

            <path
              d={pathFor()}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: "pt-log-chart-draw 1.1s ease forwards",
              }}
            />
            {points.map((p, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
            ))}
          </svg>

          {hoverIndex != null && (
            <div
              className="absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white shadow-md px-2.5 py-1.5 text-xs pointer-events-none w-max"
              style={{ left: `${tooltipLeftPct}%` }}
            >
              <p className="text-ink/50 whitespace-nowrap">{fullDates[hoverIndex]}</p>
              <p className="font-medium" style={{ color }}>
                {points[hoverIndex].value}/10
              </p>
            </div>
          )}
        </div>
      )}

      <ChartZoomModal
        open={zoomOpen}
        title={title}
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
