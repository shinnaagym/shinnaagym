"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSESSMENT_REGIONS, NRS_PAIN_OPTIONS, movementLabelWithRegion } from "@/lib/assessment-movements";
import { koreaTodayKey } from "@/lib/date";
import { svgToPngDataUrl } from "@/lib/chart-image";
import type { AssessmentMovements, AssessmentRow, PainTriggerEntry } from "@/lib/db";
import { ChartZoomModal } from "@/app/components/ChartZoomModal";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 28;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
// 같은 날짜에 여러 동작의 점수가 정확히 겹칠 때 서로 구분되도록 주는 픽셀 단위 간격.
const OVERLAP_JITTER_PX = 4;

// 통증 유발 동작·체형 평가 동작 시리즈에 순서대로 배정하는 색상 팔레트.
const SERIES_COLORS = [
  "#e2734f",
  "#2a78d6",
  "#3fa796",
  "#a35fd1",
  "#c9a227",
  "#d1477a",
  "#5f8fd1",
  "#7fae4d",
  "#b06a3f",
  "#7a6fd6",
];

interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

function shortDateLabel(raw: string): string {
  const [, m, d] = raw.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : raw;
}

function parsePainScale(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// lib/assessments.ts의 getPainTriggerEntries와 같은 로직이지만, 그쪽은 pg를
// import하는 서버 전용 모듈이라 클라이언트 컴포넌트에서 재사용할 수 없어
// 여기 따로 둔다(레거시 단일 필드 폴백 포함).
function getPainTriggerEntriesLocal(a: AssessmentRow): PainTriggerEntry[] {
  if (a.pain_triggers.length > 0) return a.pain_triggers;
  if (a.pain_trigger_note) return [{ note: a.pain_trigger_note, painScale: a.pain_scale }];
  return [];
}

interface DayGroup {
  dateKey: string;
  movements: AssessmentMovements;
  painTriggers: Record<string, number | null>;
}

// created_at은 DB 드라이버에 따라 Date 인스턴스로 올 수도, ISO 문자열로
// 올 수도 있어 항상 Date로 감싸서 다룬다.
function createdAtMs(a: AssessmentRow): number {
  return new Date(a.created_at).getTime();
}

function dateKeyOf(a: AssessmentRow): string {
  if (a.evaluated_at) return a.evaluated_at;
  return new Date(a.created_at).toISOString().slice(0, 10);
}

// 같은 날짜에 평가가 여러 건 있으면(예: 회원마다 여러 번 재평가) X축에 날짜가
// 중복 표시되지 않도록 날짜별로 묶는다. 같은 날짜에 겹치는 동작/통증 유발
// 동작 값이 있으면 나중에 작성된(created_at이 늦은) 값을 우선한다.
function groupByDate(assessments: AssessmentRow[]): DayGroup[] {
  const byDate = new Map<string, AssessmentRow[]>();
  for (const a of assessments) {
    const dateKey = dateKeyOf(a);
    const list = byDate.get(dateKey) ?? [];
    list.push(a);
    byDate.set(dateKey, list);
  }
  const groups = Array.from(byDate.entries()).map(([dateKey, list]) => {
    const sorted = [...list].sort((a, b) => createdAtMs(a) - createdAtMs(b));
    const movements: AssessmentMovements = {};
    const painTriggers: Record<string, number | null> = {};
    for (const a of sorted) {
      Object.assign(movements, a.movements);
      for (const entry of getPainTriggerEntriesLocal(a)) {
        if (!entry.note) continue;
        painTriggers[entry.note] = entry.painScale;
      }
    }
    return { dateKey, movements, painTriggers };
  });
  return groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** 통증 척도 추이 그래프에 붙는 "빠른 기록 추가" 폼 — 이미 추적 중인 동작 중 하나를 골라 오늘 날짜의 통증 점수만 새로 기록한다. */
function QuickAddPainForm({
  memberId,
  seriesOptions,
  onDone,
}: {
  memberId: number;
  seriesOptions: { key: string; label: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [seriesKey, setSeriesKey] = useState(seriesOptions[0]?.key ?? "");
  const [date, setDate] = useState(() => koreaTodayKey());
  const [painScale, setPainScale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!seriesKey || painScale === "") {
      setError("동작과 통증 점수를 선택해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { evaluatedAt: date };
      if (seriesKey.startsWith("note:")) {
        body.painTriggers = [{ note: seriesKey.slice(5), painScale: Number(painScale) }];
      } else {
        const movementId = seriesKey.slice("movement:".length);
        body.movements = {
          [movementId]: { romPassive: "", romActive: "", strength: "", painScale, compensation: "" },
        };
      }
      const res = await fetch(`/api/admin/members/${memberId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          value={seriesKey}
          onChange={(e) => setSeriesKey(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral max-w-[220px]"
        >
          {seriesOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        />
        <select
          value={painScale}
          onChange={(e) => setPainScale(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
        >
          <option value="">통증(0~10)</option>
          {NRS_PAIN_OPTIONS.map((v) => (
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

// 관리자 평가 이력 목록 위에 붙는 통증 척도 추이 그래프. 이 회원이 그동안
// 기록한 모든 통증 유발 동작 문구와 부위별 동작을 각각 하나의 선으로 동시에
// 겹쳐 보여준다. 같은 동작끼리는 데이터가 없는 날짜를 건너뛰고 선으로 이어
// 그리며, 처음 렌더링될 때 선이 왼쪽에서 오른쪽으로 그려지는 애니메이션이
// 재생된다. 재평가 시 통증이 줄어드는지 한눈에 확인하기 위한 용도.
export function AssessmentPainChart({
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

  const dayGroups = useMemo(() => groupByDate(assessments), [assessments]);

  const painTriggerNotes = useMemo(() => {
    const seen = new Set<string>();
    const notes: string[] = [];
    for (const g of dayGroups) {
      for (const note of Object.keys(g.painTriggers)) {
        if (!seen.has(note)) {
          seen.add(note);
          notes.push(note);
        }
      }
    }
    return notes;
  }, [dayGroups]);

  const movementIds = useMemo(() => {
    const idsWithData = new Set<string>();
    for (const g of dayGroups) {
      for (const [id, entry] of Object.entries(g.movements)) {
        if (entry.painScale) idsWithData.add(id);
      }
    }
    const order = ASSESSMENT_REGIONS.flatMap((r) => r.movements.map((m) => m.id));
    return order.filter((id) => idsWithData.has(id));
  }, [dayGroups]);

  if (dayGroups.length === 0) return null;

  const dateLabels = dayGroups.map((g) => shortDateLabel(g.dateKey));
  const fullDates = dayGroups.map((g) => g.dateKey);

  const series: Series[] = [
    ...painTriggerNotes.map((note, i) => ({
      key: `note:${note}`,
      label: note,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      values: dayGroups.map((g) => g.painTriggers[note] ?? null),
    })),
    ...movementIds.map((id, i) => ({
      key: `movement:${id}`,
      label: movementLabelWithRegion(id),
      color: SERIES_COLORS[(painTriggerNotes.length + i) % SERIES_COLORS.length],
      values: dayGroups.map((g) => parsePainScale(g.movements[id]?.painScale)),
    })),
  ];

  const n = dayGroups.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);

  // 통증 점수는 0~10 척도지만, 기록된 값이 전부 낮으면(4 이하) 그래프가
  // 아래쪽에 작게 몰려 보이므로 그럴 때는 축 상한을 낮춰 더 크게 보이게 한다.
  const allPainValues = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const rawMax = allPainValues.length > 0 ? Math.max(...allPainValues) : 10;
  const yMax = rawMax <= 4 ? 4 : 10;
  const gridTicks = yMax === 4 ? [0, 1, 2, 3, 4] : [0, 2, 4, 6, 8, 10];
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - v / yMax);

  // 같은 날짜에 두 개 이상의 시리즈가 정확히 같은 점수를 가지면 그리는 좌표가
  // 완전히 겹쳐 하나만 보이므로, 겹치는 시리즈끼리 좌우 대칭으로 살짝 띄운
  // y좌표를 시리즈×날짜별로 미리 계산해둔다.
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
    for (const [v, seriesIdxs] of groupsByValue) {
      const baseY = yAt(v);
      const count = seriesIdxs.length;
      seriesIdxs.forEach((si, k) => {
        yPixels[si][i] = baseY + (k - (count - 1) / 2) * OVERLAP_JITTER_PX;
      });
    }
  }

  // 데이터가 없는 날짜는 건너뛰고, 있는 점끼리만 이어서 하나의 연속된 선으로 그린다.
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
          .map((s) => ({ label: s.label, color: s.color, value: s.values[hoverIndex!] }))
          .filter((s) => s.value != null)
      : [];

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <style>{`
        @keyframes pain-chart-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="font-display text-base">통증 척도 그래프</p>
        {memberId != null && series.length > 0 && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
          >
            + 기록추가
          </button>
        )}
      </div>

      {memberId != null && showAddForm && series.length > 0 && (
        <QuickAddPainForm
          memberId={memberId}
          seriesOptions={series.map((s) => ({ key: s.key, label: s.label }))}
          onDone={() => setShowAddForm(false)}
        />
      )}

      {series.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 mb-2 text-xs text-ink/60 flex-wrap">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

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

          {series.map((s, si) => (
            <g key={s.key}>
              <path
                key={`${s.key}-${n}`}
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
                  animation: "pain-chart-draw 1.1s ease forwards",
                  animationDelay: `${si * 0.15}s`,
                }}
              />
              {s.values.map(
                (v, i) =>
                  v != null && (
                    <circle
                      key={`${s.key}-pt-${i}`}
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
              <p key={h.label} className="leading-snug break-words">
                <span className="font-medium" style={{ color: h.color }}>
                  {h.value}/10
                </span>
                <span className="text-ink/50"> {h.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ChartZoomModal
        open={zoomOpen}
        title="통증 척도 그래프"
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
