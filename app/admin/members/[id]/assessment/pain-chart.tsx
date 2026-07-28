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
const PAIN_TRIGGER_COLOR = "#e2734f";
const MOVEMENT_COLOR = "#2a78d6";
const GRID_TICKS = [0, 2, 4, 6, 8, 10];

interface Point {
  key: number;
  dateLabel: string;
  fullDate: string;
  painTrigger: number | null;
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

// 관리자 평가 이력 목록 위에 붙는 통증 척도 추이 그래프. 드롭다운으로 이
// 회원의 통증 유발 동작 문구(예: "계단 내려갈 때")를 고르면 그 문구의
// 통증척도를 선 그래프로 보여주고, 부위별 동작을 골라 두 번째 선으로
// 겹쳐볼 수도 있다. 재평가 시 통증이 줄어드는지 한눈에 확인하기 위한 용도.
export function AssessmentPainChart({ assessments }: { assessments: AssessmentRow[] }) {
  const [movementId, setMovementId] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dayGroups = useMemo(() => groupByDate(assessments), [assessments]);

  // 최근 날짜에서 먼저 언급된 문구가 앞에 오도록 정렬 — 기본 선택값으로 쓰기 좋다.
  const painTriggerOptions = useMemo(() => {
    const seen = new Set<string>();
    const notes: string[] = [];
    for (let i = dayGroups.length - 1; i >= 0; i--) {
      for (const note of Object.keys(dayGroups[i].painTriggers)) {
        if (!seen.has(note)) {
          seen.add(note);
          notes.push(note);
        }
      }
    }
    return notes;
  }, [dayGroups]);

  const [selectedPainNote, setSelectedPainNote] = useState<string>(
    () => painTriggerOptions[0] ?? "",
  );

  const movementOptions = useMemo(() => {
    const idsWithData = new Set<string>();
    for (const g of dayGroups) {
      for (const [id, entry] of Object.entries(g.movements)) {
        if (entry.painScale) idsWithData.add(id);
      }
    }
    const order = ASSESSMENT_REGIONS.flatMap((r) => r.movements.map((m) => m.id));
    return order
      .filter((id) => idsWithData.has(id))
      .map((id) => ({ id, label: movementLabelWithRegion(id) }));
  }, [dayGroups]);

  if (dayGroups.length === 0) return null;

  const points: Point[] = dayGroups.map((g, i) => ({
    key: i,
    dateLabel: shortDateLabel(g.dateKey),
    fullDate: g.dateKey,
    painTrigger: selectedPainNote ? g.painTriggers[selectedPainNote] ?? null : null,
    movement: movementId ? parsePainScale(g.movements[movementId]?.painScale) : null,
  }));

  const n = points.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = n > 1 ? plotWidth / (n - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + (n > 1 ? i * xStep : plotWidth / 2);
  const yAt = (v: number) => PAD_TOP + plotHeight * (1 - v / 10);

  function pathFor(key: "painTrigger" | "movement"): string {
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
        <div className="flex gap-2 flex-wrap">
          {painTriggerOptions.length > 0 && (
            <select
              value={selectedPainNote}
              onChange={(e) => setSelectedPainNote(e.target.value)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs outline-none max-w-[180px]"
            >
              <option value="">통증 유발 동작 선택 안 함</option>
              {painTriggerOptions.map((note) => (
                <option key={note} value={note}>
                  {note}
                </option>
              ))}
            </select>
          )}
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
      </div>

      <div className="flex items-center gap-4 mb-2 text-xs text-ink/60 flex-wrap">
        {selectedPainNote && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: PAIN_TRIGGER_COLOR }}
            />
            {selectedPainNote}
          </span>
        )}
        {movementId && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: MOVEMENT_COLOR }} />
            {movementOptions.find((o) => o.id === movementId)?.label}
          </span>
        )}
      </div>

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

          {selectedPainNote && (
            <>
              <path
                d={pathFor("painTrigger")}
                fill="none"
                stroke={PAIN_TRIGGER_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map(
                (p, i) =>
                  p.painTrigger != null && (
                    <circle
                      key={`p-${p.key}`}
                      cx={xAt(i)}
                      cy={yAt(p.painTrigger)}
                      r={4}
                      fill={PAIN_TRIGGER_COLOR}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ),
              )}
            </>
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

        {hovered && (hovered.painTrigger != null || hovered.movement != null) && (
          <div
            className="absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white shadow-md px-2.5 py-1.5 text-xs pointer-events-none w-max max-w-[220px]"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="text-ink/50 mb-0.5 whitespace-nowrap">{hovered.fullDate}</p>
            {hovered.painTrigger != null && (
              <p className="leading-snug break-words">
                <span className="font-medium">{hovered.painTrigger}</span>
                <span className="text-ink/50"> /10 {selectedPainNote}</span>
              </p>
            )}
            {hovered.movement != null && (
              <p className="whitespace-nowrap mt-0.5">
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
