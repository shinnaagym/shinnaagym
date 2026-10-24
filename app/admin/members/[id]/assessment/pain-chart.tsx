"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSESSMENT_REGIONS, NRS_PAIN_OPTIONS, movementLabelWithRegion } from "@/lib/assessment-movements";
import { koreaTodayKey } from "@/lib/date";
import { appendSummaryToSvgClone, svgToPngDataUrl } from "@/lib/chart-image";
import type { AssessmentMovements, AssessmentRow, PainTriggerEntry } from "@/lib/db";
import { ChartZoomModal } from "@/app/components/ChartZoomModal";
import { DisclosureToggle } from "@/app/components/DisclosureToggle";

const WIDTH = 640;
const HEIGHT = 640;
const PAD_LEFT = 28;
const PAD_RIGHT = 16;
const PAD_TOP = 28;
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

function firstLastNonNull(values: (number | null)[]): { first: number; last: number } | null {
  const nonNull = values.filter((v): v is number => v != null);
  if (nonNull.length === 0) return null;
  return { first: nonNull[0], last: nonNull[nonNull.length - 1] };
}

/** 시리즈 키(movement:{id}:passive|active)에서 가동범위 값을 뽑아온다.
    통증 체크가 없어도 가동범위만 기록됐을 수 있어, 통증 값과 별개로 마지막
    기록된 가동범위를 찾는다. */
function lastRomFor(key: string, dayGroups: DayGroup[]): string | null {
  if (!key.startsWith("movement:")) return null;
  const rest = key.slice("movement:".length);
  const lastColon = rest.lastIndexOf(":");
  const movementId = rest.slice(0, lastColon);
  const romType = rest.slice(lastColon + 1);
  for (let i = dayGroups.length - 1; i >= 0; i--) {
    const entry = dayGroups[i].movements[movementId];
    const rom = romType === "passive" ? entry?.romPassive : entry?.romActive;
    if (rom) return rom;
  }
  return null;
}

/** 한눈에 "이 동작이 이렇게 좋아졌다"를 알 수 있도록, 시리즈마다 처음→최근
    통증 추이(그리고 동작이면 가동범위)를 한 줄 문구로 만든다. */
function summaryLineFor(s: Series, dayGroups: DayGroup[]): string {
  const fl = firstLastNonNull(s.values);
  const trend = !fl ? "-" : fl.first === fl.last ? `${fl.last}/10` : `${fl.first}/10 → ${fl.last}/10`;
  const rom = lastRomFor(s.key, dayGroups);
  return `${s.label} — 통증 ${trend}${rom ? ` · 가동범위 ${rom}` : ""}`;
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
        const rest = seriesKey.slice("movement:".length);
        const lastColon = rest.lastIndexOf(":");
        const movementId = rest.slice(0, lastColon);
        const romType = rest.slice(lastColon + 1); // "passive" | "active"
        body.movements = {
          [movementId]: {
            romPassive: "",
            romActive: "",
            strength: "",
            compensation: "",
            painPassive: romType === "passive" ? painScale : "",
            painActive: romType === "active" ? painScale : "",
          },
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

interface PainPointTarget {
  seriesKey: string;
  dateKey: string;
  dateLabel: string;
  label: string;
  color: string;
  value: number;
}

/** 그래프의 점을 눌렀을 때 뜨는 수정/삭제 모달 — 기록 한 건을 바로 고치거나 지운다. */
function PainPointModal({
  memberId,
  target,
  onClose,
  onSaved,
}: {
  memberId: number;
  target: PainPointTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(target.value));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(painScale: number | null) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/assessments/pain-point`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: target.dateKey, seriesKey: target.seriesKey, painScale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "처리에 실패했어요.");
        return;
      }
      router.refresh();
      onSaved();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg px-5 py-5">
        <p className="font-display text-base mb-1">기록 수정</p>
        <p className="text-xs text-ink/50 mb-3">
          {target.dateLabel} · <span style={{ color: target.color }}>{target.label}</span>
        </p>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral mb-4"
        >
          {NRS_PAIN_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-coral mb-3">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => send(null)}
            disabled={submitting}
            className="rounded-full border border-coral/40 text-coral px-4 py-1.5 text-sm hover:bg-coral/10 transition disabled:opacity-40"
          >
            삭제
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-bone transition disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => send(Number(value))}
              disabled={submitting}
              className="rounded-full bg-coral text-white px-4 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      </div>
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
  const [expanded, setExpanded] = useState(false);
  const [editTarget, setEditTarget] = useState<PainPointTarget | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  async function handleZoom() {
    if (!svgRef.current) return;
    setZoomOpen(true);
    setZoomLoading(true);
    try {
      // 인라인 그래프 자체는 예전 크기를 유지하고, 확대·이미지 저장용으로만
      // "처음→최근 요약"을 덧붙인 별도 SVG를 만들어 캡처한다.
      const exportSvg = appendSummaryToSvgClone(
        svgRef.current,
        summaryLines,
        series.map((s) => s.color),
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

  const passiveMovementIds = useMemo(() => {
    const idsWithData = new Set<string>();
    for (const g of dayGroups) {
      for (const [id, entry] of Object.entries(g.movements)) {
        if (entry.painPassive) idsWithData.add(id);
      }
    }
    const order = ASSESSMENT_REGIONS.flatMap((r) => r.movements.map((m) => m.id));
    return order.filter((id) => idsWithData.has(id));
  }, [dayGroups]);

  const activeMovementIds = useMemo(() => {
    const idsWithData = new Set<string>();
    for (const g of dayGroups) {
      for (const [id, entry] of Object.entries(g.movements)) {
        if (entry.painActive) idsWithData.add(id);
      }
    }
    const order = ASSESSMENT_REGIONS.flatMap((r) => r.movements.map((m) => m.id));
    return order.filter((id) => idsWithData.has(id));
  }, [dayGroups]);

  if (dayGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="font-display text-base">통증 척도 그래프</p>
          <DisclosureToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            label={expanded ? "통증 척도 그래프 접기" : "통증 척도 그래프 펼치기"}
          />
        </div>
        {expanded && (
          <p className="text-sm text-ink/40 text-center py-6">아직 기록된 통증 척도가 없어요.</p>
        )}
      </div>
    );
  }

  const rawSeries: Series[] = [
    ...painTriggerNotes.map((note, i) => ({
      key: `note:${note}`,
      label: note,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      values: dayGroups.map((g) => g.painTriggers[note] ?? null),
    })),
    ...passiveMovementIds.map((id, i) => ({
      key: `movement:${id}:passive`,
      label: `${movementLabelWithRegion(id)} · 수동`,
      color: SERIES_COLORS[(painTriggerNotes.length + i) % SERIES_COLORS.length],
      values: dayGroups.map((g) => parsePainScale(g.movements[id]?.painPassive)),
    })),
    ...activeMovementIds.map((id, i) => ({
      key: `movement:${id}:active`,
      label: `${movementLabelWithRegion(id)} · 능동`,
      color:
        SERIES_COLORS[
          (painTriggerNotes.length + passiveMovementIds.length + i) % SERIES_COLORS.length
        ],
      values: dayGroups.map((g) => parsePainScale(g.movements[id]?.painActive)),
    })),
  ];

  // 어떤 시리즈에도 값이 없는 날짜(예: 그날 평가에 통증과 무관한 항목만
  // 기록된 경우)는 x축에서 아예 빼서, 실제 기록이 있는 날짜만 표시한다.
  const keepIdx = dayGroups.map((_, i) => rawSeries.some((s) => s.values[i] != null));
  const dayGroupsFiltered = dayGroups.filter((_, i) => keepIdx[i]);
  if (dayGroupsFiltered.length === 0) {
    return (
      <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="font-display text-base">통증 척도 그래프</p>
          <DisclosureToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            label={expanded ? "통증 척도 그래프 접기" : "통증 척도 그래프 펼치기"}
          />
        </div>
        {expanded && (
          <p className="text-sm text-ink/40 text-center py-6">아직 기록된 통증 척도가 없어요.</p>
        )}
      </div>
    );
  }

  const dateLabels = dayGroupsFiltered.map((g) => shortDateLabel(g.dateKey));
  const fullDates = dayGroupsFiltered.map((g) => g.dateKey);
  const series: Series[] = rawSeries.map((s) => ({
    ...s,
    values: s.values.filter((_, i) => keepIdx[i]),
  }));

  const n = dayGroupsFiltered.length;
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

  // "이 동작이 이렇게 좋아졌다" 요약. 화면에 항상 보이는 인라인 그래프에는 넣지
  // 않고(글자 수가 늘어도 그래프 크기가 예전 그대로 유지되도록), 확대·이미지
  // 저장 시 handleZoom에서 appendSummaryToSvgClone으로만 덧붙인다.
  const summaryLines = series.map((s) => summaryLineFor(s, dayGroupsFiltered));

  // 그래프의 작은 점을 정확히 탭하기 어려운 사람들을 위한 대안 — 같은 기록을
  // 최신순 목록으로도 보여주고, 각 줄의 "수정" 버튼을 누르면 점을 눌렀을 때와
  // 동일한 수정/삭제 모달이 뜬다.
  const allPoints = series
    .flatMap((s) =>
      s.values.map((v, i) =>
        v == null ? null : { seriesKey: s.key, label: s.label, color: s.color, dateKey: fullDates[i], value: v },
      ),
    )
    .filter((p): p is { seriesKey: string; label: string; color: string; dateKey: string; value: number } => p != null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.label.localeCompare(b.label));

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
        <div className="flex items-center gap-2">
          {series.length > 0 && expanded && (
            <button
              type="button"
              onClick={handleZoom}
              className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
            >
              이미지 저장
            </button>
          )}
          {memberId != null && series.length > 0 && !showAddForm && expanded && (
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
            label={expanded ? "통증 척도 그래프 접기" : "통증 척도 그래프 펼치기"}
          />
        </div>
      </div>

      {expanded && (
        <>
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

      {memberId != null && series.length > 0 && (
        <p className="text-xs text-ink/40 mb-2">점을 누르면 그 기록을 수정하거나 삭제할 수 있어요.</p>
      )}

      <div className="relative">
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
                    <g key={`${s.key}-pt-${i}`}>
                      <circle
                        cx={xAt(i)}
                        cy={yPixels[si][i]}
                        r={4}
                        fill={s.color}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      <text
                        x={xAt(i)}
                        y={yPixels[si][i] - 11}
                        textAnchor="middle"
                        fontSize={15}
                        fontWeight={700}
                        fill={s.color}
                        stroke="#ffffff"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {v}
                      </text>
                    </g>
                  ),
              )}
            </g>
          ))}
        </svg>

        {/* 숫자를 누르면 수정/삭제 모달을 띄우는 탭 영역 — SVG 도형(투명/반투명
            원 등)으로 히트 영역을 만들면 iOS Safari 등 일부 브라우저가 이를
            탭 대상으로 잡지 않는 경우가 있어, 항상 확실히 탭되는 실제 HTML
            button을 좌표 비율로 겹쳐 그린다(아래 날짜 툴팁과 동일한 퍼센트
            포지셔닝 방식). 숫자 라벨은 점보다 11(viewBox 단위) 위에 그려지므로,
            숫자와 점을 모두 넉넉히 덮도록 그 중간 지점에 큼직하게(36px) 둔다. */}
        {memberId != null &&
          series.map((s, si) =>
            s.values.map(
              (v, i) =>
                v != null && (
                  <button
                    key={`${s.key}-hit-${i}`}
                    type="button"
                    aria-label={`${s.label} ${fullDates[i]} 기록 수정`}
                    onClick={() =>
                      setEditTarget({
                        seriesKey: s.key,
                        dateKey: fullDates[i],
                        dateLabel: fullDates[i],
                        label: s.label,
                        color: s.color,
                        value: v,
                      })
                    }
                    className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
                    style={{
                      left: `${(xAt(i) / WIDTH) * 100}%`,
                      top: `${((yPixels[si][i] - 6) / HEIGHT) * 100}%`,
                    }}
                  />
                ),
            ),
          )}

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

      {memberId != null && allPoints.length > 0 && (
        <>
          <p className="text-xs text-ink/40 mt-3 mb-1.5">점을 누르기 어려우면 아래 목록에서 수정하세요.</p>
          <div className="rounded-xl border border-line/50 divide-y divide-line/40 max-h-64 overflow-y-auto">
            {allPoints.map((p) => (
              <div
                key={`${p.seriesKey}-${p.dateKey}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-ink/50 text-xs mr-2">{p.dateKey}</span>
                  <span className="font-medium" style={{ color: p.color }}>
                    {p.value}/10
                  </span>
                  <span className="text-ink/60"> {p.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditTarget({
                      seriesKey: p.seriesKey,
                      dateKey: p.dateKey,
                      dateLabel: p.dateKey,
                      label: p.label,
                      color: p.color,
                      value: p.value,
                    })
                  }
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-coral/40 hover:text-coral transition"
                >
                  수정
                </button>
              </div>
            ))}
          </div>
        </>
      )}
        </>
      )}

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

      {memberId != null && editTarget && (
        <PainPointModal
          memberId={memberId}
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
