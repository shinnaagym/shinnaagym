"use client";

import { useMemo, useState } from "react";
import { ASSESSMENT_REGIONS, findMovementLabel } from "@/lib/assessment-movements";
import type { AssessmentRow } from "@/lib/db";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 28;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const OVERALL_COLOR = "#e2734f";
const MOVEMENT_COLOR = "#2a78d6";
const GRID_TICKS = [0, 2, 4, 6, 8, 10];

interface Point {
  key: number;
  dateLabel: string;
  fullDate: string;
  overall: number | null;
  movement: number | null;
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

// 관리자 평가 이력 목록 위에 붙는 통증 척도 추이 그래프. 전체(맨 아래 통증 유발
// 동작) 통증척도는 항상 표시하고, 드롭다운으로 특정 동작을 고르면 그 동작의
// 통증척도를 두 번째 선으로 겹쳐 보여준다. 재평가 시 통증이 줄어드는지
// 한눈에 확인하기 위한 용도.
export function AssessmentPainChart({ assessments }: { assessments: AssessmentRow[] }) {
  const [movementId, setMovementId] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chronological = useMemo(
    () =>
      [...assessments].sort((a, b) =>
        (a.evaluated_at || a.created_at).localeCompare(b.evaluated_at || b.created_at),
      ),
    [assessments],
  );

  const movementOptions = useMemo(() => {
    const idsWithData = new Set<string>();
    for (const a of chronological) {
      for (const [id, entry] of Object.entries(a.movements)) {
        if (entry.painScale) idsWithData.add(id);
      }
    }
    const order = ASSESSMENT_REGIONS.flatMap((r) => r.movements.map((m) => m.id));
    return order
      .filter((id) => idsWithData.has(id))
      .map((id) => ({ id, label: findMovementLabel(id)?.ko ?? id }));
  }, [chronological]);

  if (chronological.length === 0) return null;

  const points: Point[] = chronological.map((a, i) => {
    const rawDate = a.evaluated_at || a.created_at.slice(0, 10);
    return {
      key: i,
      dateLabel: shortDateLabel(rawDate),
      fullDate: rawDate,
      overall: a.pain_scale,
      movement: movementId ? parsePainScale(a.movements[movementId]?.painScale) : null,
    };
  });

  const n = points.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - v / 10);

  function pathFor(key: "overall" | "movement"): string {
    let d = "";
    let started = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        started = false;
        return;
      }
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

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="font-display text-base">통증 척도 추이</p>
        {movementOptions.length > 0 && (
          <select
            value={movementId}
            onChange={(e) => setMovementId(e.target.value)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs outline-none"
          >
            <option value="">동작 선택 안 함</option>
            {movementOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {movementId && (
        <div className="flex items-center gap-4 mb-2 text-xs text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: OVERALL_COLOR }} />
            전체 통증
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: MOVEMENT_COLOR }} />
            {movementOptions.find((o) => o.id === movementId)?.label}
          </span>
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

          {points.map((p, i) => (
            <text
              key={p.key}
              x={xAt(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={9}
              fill="#8a8578"
            >
              {p.dateLabel}
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

          <path d={pathFor("overall")} fill="none" stroke={OVERALL_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {points.map(
            (p, i) =>
              p.overall != null && (
                <circle key={`o-${p.key}`} cx={xAt(i)} cy={yAt(p.overall)} r={4} fill={OVERALL_COLOR} stroke="#ffffff" strokeWidth={2} />
              ),
          )}

          {movementId && (
            <>
              <path d={pathFor("movement")} fill="none" stroke={MOVEMENT_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {points.map(
                (p, i) =>
                  p.movement != null && (
                    <circle key={`m-${p.key}`} cx={xAt(i)} cy={yAt(p.movement)} r={4} fill={MOVEMENT_COLOR} stroke="#ffffff" strokeWidth={2} />
                  ),
              )}
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white shadow-md px-2.5 py-1.5 text-xs pointer-events-none whitespace-nowrap"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="text-ink/50 mb-0.5">{hovered.fullDate}</p>
            {hovered.overall != null && (
              <p>
                <span className="font-medium">{hovered.overall}</span>
                <span className="text-ink/50"> /10 전체</span>
              </p>
            )}
            {movementId && hovered.movement != null && (
              <p>
                <span className="font-medium">{hovered.movement}</span>
                <span className="text-ink/50">
                  {" "}
                  /10 {movementOptions.find((o) => o.id === movementId)?.label}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
