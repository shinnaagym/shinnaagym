"use client";

import { useMemo, useState } from "react";
import { ASSESSMENT_REGIONS, movementLabelWithRegion } from "@/lib/assessment-movements";
import type { AssessmentMovements, AssessmentRow, PainTriggerEntry } from "@/lib/db";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 28;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const GRID_TICKS = [0, 2, 4, 6, 8, 10];

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

// 관리자 평가 이력 목록 위에 붙는 통증 척도 추이 그래프. 이 회원이 그동안
// 기록한 모든 통증 유발 동작 문구와 부위별 동작을 각각 하나의 선으로 동시에
// 겹쳐 보여준다. 같은 동작끼리는 데이터가 없는 날짜를 건너뛰고 선으로 이어
// 그리며, 처음 렌더링될 때 선이 왼쪽에서 오른쪽으로 그려지는 애니메이션이
// 재생된다. 재평가 시 통증이 줄어드는지 한눈에 확인하기 위한 용도.
export function AssessmentPainChart({ assessments }: { assessments: AssessmentRow[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - v / 10);

  // 데이터가 없는 날짜는 건너뛰고, 있는 점끼리만 이어서 하나의 연속된 선으로 그린다.
  function pathFor(values: (number | null)[]): string {
    let d = "";
    let started = false;
    values.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? "L" : "M"}${xAt(i)},${yAt(v)} `;
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
      <p className="font-display text-base mb-2">통증 척도 추이</p>

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

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {GRID_TICKS.map((t) => (
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
                d={pathFor(s.values)}
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
                      cy={yAt(v)}
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
    </div>
  );
}
