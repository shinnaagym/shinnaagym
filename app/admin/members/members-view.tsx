"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import type {
  CoachRow,
  ContractRow,
  MemberStatus,
  PackageRow,
  PaymentMethod,
  PtType,
  VisitChannel,
} from "@/lib/db";
import type { FixedSlotWithMember, MemberWithProgress } from "@/lib/schedule";
import { COACH_COLOR_PALETTE, PURPOSE_OPTIONS, SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import type { CoachColorStyle } from "@/lib/constants";
import { VISIT_CHANNEL_OPTIONS } from "@/lib/intake-questionnaire";
import { ContractDocument } from "@/app/components/ContractDocument";
import { SignaturePad } from "@/app/components/SignaturePad";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const PT_TYPE_OPTIONS: PtType[] = ["1:1", "2:1"];
const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["card", "transfer"];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "카드결제",
  transfer: "계좌이체",
};
const FIXED_SLOT_WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토"];
const FIXED_SLOT_CAPACITY = 1;

type MemberSortKey = "name" | "remaining" | "type" | "nextWeek";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  active,
  dir,
  onClick,
  center,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  center?: boolean;
}) {
  return (
    <th
      className={["px-5 py-3 font-medium whitespace-nowrap", center ? "text-center" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className={["flex items-center gap-1 hover:text-coral", center ? "mx-auto" : ""].filter(Boolean).join(" ")}
      >
        {label}
        <span className={active ? "text-coral" : "text-ink/30"}>{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

// 데스크톱 표의 SortHeader와 같은 정렬 상태를 쓰는 모바일 카드 목록용 정렬
// 칩. 표 헤더가 없는 모바일에서는 이 칩 목록으로 같은 정렬을 적용한다.
function SortChip({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-coral text-coral bg-coral/5" : "border-line text-ink/60 hover:bg-bone",
      ].join(" ")}
    >
      {label}
      <span className={active ? "text-coral" : "text-ink/30"}>{dir === "asc" ? "▲" : "▼"}</span>
    </button>
  );
}

function cellKey(weekday: number, hour: number): string {
  return `${weekday}-${hour}`;
}

/** 선택된 요일·시간 셀들을 "월 9~11시, 14시, 수 10시" 형태의 읽기 쉬운 텍스트로 변환. */
function formatAvailability(selected: Set<string>): string {
  const byWeekday = new Map<number, number[]>();
  for (const key of selected) {
    const [weekday, hour] = key.split("-").map(Number);
    const hours = byWeekday.get(weekday) ?? [];
    hours.push(hour);
    byWeekday.set(weekday, hours);
  }
  const parts: string[] = [];
  for (let weekday = 0; weekday < FIXED_SLOT_WEEKDAY_LABELS.length; weekday++) {
    const hours = byWeekday.get(weekday);
    if (!hours || hours.length === 0) continue;
    hours.sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = hours[0];
    let prev = hours[0];
    for (let i = 1; i <= hours.length; i++) {
      const h = hours[i];
      if (h === prev + 1) {
        prev = h;
        continue;
      }
      ranges.push(start === prev ? `${start}시` : `${start}~${prev}시`);
      if (h !== undefined) {
        start = h;
        prev = h;
      }
    }
    parts.push(`${FIXED_SLOT_WEEKDAY_LABELS[weekday]} ${ranges.join(", ")}`);
  }
  return parts.join(", ");
}

/** "가능한 요일·시간"을 드래그로 복수 선택할 수 있는 주간 시간표. 선택 결과를
    읽기 쉬운 텍스트로 변환해 부모의 텍스트 입력값을 갱신한다(기존 자유 텍스트는
    직접 수정도 계속 가능). */
function AvailabilityGridPicker({
  onChange,
  lockable = false,
}: {
  onChange: (text: string) => void;
  /** true면 기본은 잠금(보기 전용)이라 드래그가 안 먹고, "수정"을 눌러야 편집할
      수 있다. "저장"을 누르면 다시 잠긴다 — 스크롤하다 실수로 칸을 건드려 값이
      바뀌는 사고를 막기 위함(기존 회원 상세에서만 씀. 신규 등록 흐름은 아직 아무것도
      저장된 게 없어 잠글 필요가 없다). */
  lockable?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const paintModeRef = useRef<"add" | "remove" | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [locked, setLocked] = useState(lockable);

  function applyCell(weekday: number, hour: number, mode: "add" | "remove") {
    const key = cellKey(weekday, hour);
    const has = selectedRef.current.has(key);
    if ((mode === "add" && has) || (mode === "remove" && !has)) return;
    const next = new Set(selectedRef.current);
    if (mode === "add") next.add(key);
    else next.delete(key);
    selectedRef.current = next;
    setSelected(next);
    onChange(formatAvailability(next));
  }

  function handlePointerDown(weekday: number, hour: number) {
    if (locked) return;
    const mode: "add" | "remove" = selectedRef.current.has(cellKey(weekday, hour)) ? "remove" : "add";
    paintModeRef.current = mode;
    setIsPainting(true);
    applyCell(weekday, hour, mode);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (locked || !paintModeRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const cellEl = el?.closest<HTMLElement>("[data-weekday]");
    if (!cellEl) return;
    const weekday = Number(cellEl.dataset.weekday);
    const hour = Number(cellEl.dataset.hour);
    applyCell(weekday, hour, paintModeRef.current);
  }

  useEffect(() => {
    function endPaint() {
      paintModeRef.current = null;
      setIsPainting(false);
    }
    window.addEventListener("pointerup", endPaint);
    window.addEventListener("pointercancel", endPaint);
    return () => {
      window.removeEventListener("pointerup", endPaint);
      window.removeEventListener("pointercancel", endPaint);
    };
  }, []);

  function clearAll() {
    const next = new Set<string>();
    selectedRef.current = next;
    setSelected(next);
    onChange("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="text-xs text-ink/40">
          {locked
            ? "수정을 눌러야 편집할 수 있어요."
            : "표를 드래그하면 여러 칸을 한 번에 선택할 수 있어요."}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {!locked && selected.size > 0 && (
            <button type="button" onClick={clearAll} className="text-xs text-coral hover:underline">
              선택 지우기
            </button>
          )}
          {lockable && (
            <button
              type="button"
              onClick={() => setLocked((v) => !v)}
              className="text-xs text-coral hover:underline"
            >
              {locked ? "수정" : "저장"}
            </button>
          )}
        </div>
      </div>
      <div
        className="rounded-xl border border-line overflow-x-auto select-none"
        style={{ touchAction: isPainting ? "none" : "auto" }}
        onPointerMove={handlePointerMove}
      >
        <table className="w-full text-[11px] border-collapse min-w-[420px]">
          <thead>
            <tr className="text-ink/50 border-b border-line/60">
              <th className="px-1.5 py-1 font-medium w-10">시간</th>
              {FIXED_SLOT_WEEKDAY_LABELS.map((label) => (
                <th key={label} className="px-1.5 py-1 font-medium text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_HOUR_ROWS.map((hour) => (
              <tr key={hour} className="border-b border-line/20 last:border-0">
                <td className="px-1.5 py-1 text-ink/40 whitespace-nowrap">{hour}시</td>
                {FIXED_SLOT_WEEKDAY_LABELS.map((_, weekday) => {
                  const active = selected.has(cellKey(weekday, hour));
                  return (
                    <td
                      key={weekday}
                      data-weekday={weekday}
                      data-hour={hour}
                      onPointerDown={() => handlePointerDown(weekday, hour)}
                      className={[
                        "px-1.5 py-1 text-center border-l border-line/10",
                        locked ? "cursor-default" : "cursor-pointer",
                        active ? "bg-coral text-white" : locked ? "" : "hover:bg-bone/60",
                      ].join(" ")}
                    >
                      {active ? "✓" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SessionSummary = {
  id: number;
  session_date: string;
  session_hour: number;
  status: string;
  ordinal: number | null;
  total_sessions: number | null;
};

type MemberDetail = {
  id: number;
  name: string;
  phone: string;
  coach_id: number | null;
  notes: string;
  referrer: string;
  available_times: string;
  token: string;
  status: MemberStatus;
};

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

// 계약서 제3조 환불 조항: "레슨비 + 위약금(10%) + 수수료(5%)"를 제하고 환불.
// 경과일수/계약기간은 반영하지 않는다(계약기간을 유도리껏 연장해주는 경우가 많아
// 경과일수가 실제 사용량을 반영하지 못하므로) — 대신 회원 전체 진행률(완료 세션 /
// 전체 세션)을 레슨비 사용 비율로 삼는다. 재등록 등으로 패키지가 여러 건이어도
// 가장 최근 패키지 결제금액을 기준으로 계산한다.
function computeRefund(
  pkg: PackageRow,
  progress: { totalSessions: number; doneCount: number },
): {
  usedRatio: number;
  lessonFee: number;
  penalty: number;
  fee: number;
  refundAmount: number;
} {
  const usedRatio =
    progress.totalSessions > 0
      ? Math.min(1, Math.max(0, progress.doneCount / progress.totalSessions))
      : 0;
  const lessonFee = Math.round(pkg.price * usedRatio);
  const penalty = Math.round(pkg.price * 0.1);
  const fee = Math.round(pkg.price * 0.05);
  const refundAmount = Math.min(pkg.price, Math.max(0, pkg.price - lessonFee - penalty - fee));
  return { usedRatio, lessonFee, penalty, fee, refundAmount };
}

function TypeBadge({ isFirst }: { isFirst: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        isFirst ? "bg-coral/10 text-coral" : "bg-sage/20 text-sage",
      ].join(" ")}
    >
      {isFirst ? "초" : "재"}
    </span>
  );
}

function PtTypeBadge({ ptType }: { ptType: PtType }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        ptType === "2:1" ? "bg-indigo-100 text-indigo-700" : "bg-line/40 text-ink/50",
      ].join(" ")}
    >
      {ptType}
    </span>
  );
}

function GoldenBellBadge() {
  return (
    <span
      title="재등록 골든타임 — 잔여 3회 이하"
      className="rounded-full bg-gold/15 text-gold-deep px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
    >
      🔔 골든벨
    </span>
  );
}

function ReferrerBadge({ referrer }: { referrer: string }) {
  return (
    <span
      title="소개해주신 분"
      className="rounded-full bg-line/40 text-ink/50 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
    >
      소개: {referrer}
    </span>
  );
}

function PtTypeToggle({
  value,
  onChange,
}: {
  value: PtType;
  onChange: (t: PtType) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
      {PT_TYPE_OPTIONS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            "flex-1 rounded-full py-1.5 font-medium transition",
            value === t ? "bg-coral text-white shadow-sm" : "text-ink/60",
          ].join(" ")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
      {PAYMENT_METHOD_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={[
            "flex-1 rounded-full py-1.5 font-medium transition",
            value === m ? "bg-coral text-white shadow-sm" : "text-ink/60",
          ].join(" ")}
        >
          {PAYMENT_METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        method === "transfer" ? "bg-sage/20 text-sage" : "bg-line/40 text-ink/50",
      ].join(" ")}
    >
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}

export function MembersView({
  initialMembers,
  coaches,
  initialFixedSlots,
  initialOpenId,
  initialShowContractView,
}: {
  initialMembers: MemberWithProgress[];
  coaches: CoachRow[];
  initialFixedSlots: FixedSlotWithMember[];
  initialOpenId?: number | null;
  initialShowContractView?: boolean;
}) {
  const members = initialMembers;
  const fixedSlots = initialFixedSlots;
  const activeCoaches = useMemo(() => coaches.filter((c) => c.active), [coaches]);
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState<number | "all" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(initialOpenId ?? null);
  // ?open=id&contract=1 딥링크는 처음 열렸을 때 한 번만 계약서 화면을 자동으로
  // 보여줘야 한다. URL은 setDetailId로 바뀌지 않아 그대로 남아있으므로, 모달을
  // 닫은 뒤 같은 회원을 다시 열면 계약서 창이 계속 재발생하던 문제를 막는다.
  const [initialContractConsumed, setInitialContractConsumed] = useState(false);
  const [sortKey, setSortKey] = useState<MemberSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: MemberSortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    return members.filter((m) => {
      // 상담 단계(패키지 결제 전)에서 자동 등록된 lead는 회원 관리 목록에 노출하지
      // 않는다. 스케줄표의 "결제" 버튼으로 ?open=id 딥링크될 때는 members 원본
      // 배열에서 바로 찾으므로 이 필터의 영향을 받지 않는다.
      if (m.is_lead) return false;
      if (search && !m.name.includes(search)) return false;
      if (coachFilter === "unassigned") {
        if (m.coach_id !== null) return false;
      } else if (coachFilter !== "all" && m.coach_id !== coachFilter) {
        return false;
      }
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, search, coachFilter, statusFilter]);

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    const sortValue = (m: MemberWithProgress): number | string => {
      switch (sortKey) {
        case "name":
          return m.name;
        case "remaining":
          return m.total_sessions - m.done_count;
        case "type":
          return m.package_count < 2 ? 0 : 1;
        case "nextWeek":
          return m.has_next_week_session ? 1 : 0;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  /** 초진/재등록, 그리고 그중 소개로 온 회원 수를 따로 집계한다(현재 필터 적용 목록 기준).
      초=현재 패키지가 첫 패키지, 재=재등록(2번째 이상 패키지), 소개(초)/소개(재)=그중 소개(referrer)로 온 경우. */
  const typeStats = useMemo(() => {
    let first = 0;
    let renewal = 0;
    let referralFirst = 0;
    let referralRenewal = 0;
    for (const m of filtered) {
      if (m.total_sessions <= 0) continue;
      const isFirst = m.package_count < 2;
      if (isFirst) first += 1;
      else renewal += 1;
      if (m.referrer) {
        if (isFirst) referralFirst += 1;
        else referralRenewal += 1;
      }
    }
    return { first, renewal, referralFirst, referralRenewal };
  }, [filtered]);

  async function refresh() {
    window.location.reload();
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-3 text-xs">
        <span className="rounded-full bg-coral/10 text-coral px-3 py-1 font-medium">
          초 {typeStats.first}명
        </span>
        <span className="rounded-full bg-sage/20 text-sage px-3 py-1 font-medium">
          재 {typeStats.renewal}명
        </span>
        <span className="rounded-full bg-line/40 text-ink/60 px-3 py-1 font-medium">
          소개(초) {typeStats.referralFirst}명
        </span>
        <span className="rounded-full bg-line/40 text-ink/60 px-3 py-1 font-medium">
          소개(재) {typeStats.referralRenewal}명
        </span>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-coral"
          />
          <select
            value={coachFilter}
            onChange={(e) => {
              const v = e.target.value;
              setCoachFilter(v === "all" ? "all" : v === "unassigned" ? "unassigned" : Number(v));
            }}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="all">담당 코치 전체</option>
            <option value="unassigned">미지정</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | "all")}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="all">전체</option>
          </select>
          <span className="text-sm text-ink/50">{filtered.length}명</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-coral text-white px-5 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          + 신규 회원 등록
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40">
          회원이 없어요.
        </div>
      ) : (
        <>
          {/* 모바일: 카드 목록 (좁은 화면에서 표 가로 스크롤 대신) */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3 sm:hidden">
            <SortChip
              label="이름"
              active={sortKey === "name"}
              dir={sortKey === "name" ? sortDir : "asc"}
              onClick={() => toggleSort("name")}
            />
            <SortChip
              label="잔여"
              active={sortKey === "remaining"}
              dir={sortKey === "remaining" ? sortDir : "asc"}
              onClick={() => toggleSort("remaining")}
            />
            <SortChip
              label="초/재"
              active={sortKey === "type"}
              dir={sortKey === "type" ? sortDir : "asc"}
              onClick={() => toggleSort("type")}
            />
            <SortChip
              label="다음주"
              active={sortKey === "nextWeek"}
              dir={sortKey === "nextWeek" ? sortDir : "asc"}
              onClick={() => toggleSort("nextWeek")}
            />
          </div>
          <div className="grid gap-3 sm:hidden">
            {sortedFiltered.map((m) => {
              const remaining = m.total_sessions - m.done_count;
              const pct =
                m.total_sessions > 0
                  ? Math.min(100, Math.round((m.done_count / m.total_sessions) * 100))
                  : 0;
              const coachName = coaches.find((c) => c.id === m.coach_id)?.name ?? "-";
              const expired = m.total_sessions > 0 && remaining <= 0;
              const low = !expired && remaining > 0 && remaining <= 3;
              const goldenBell = m.status === "active" && m.total_sessions > 0 && remaining <= 3;
              return (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailId(m.id)}
                  onKeyDown={(e) => e.key === "Enter" && setDetailId(m.id)}
                  className="text-left rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5 active:bg-bone/40 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-medium flex items-center gap-1.5 flex-wrap">
                      {m.name}
                      {m.total_sessions > 0 && <TypeBadge isFirst={m.package_count < 2} />}
                      {goldenBell && <GoldenBellBadge />}
                      {m.referrer && <ReferrerBadge referrer={m.referrer} />}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={[
                          "rounded-full px-2.5 py-0.5 text-xs shrink-0",
                          m.status === "active"
                            ? "bg-sage/20 text-sage"
                            : "bg-line/40 text-ink/50",
                        ].join(" ")}
                      >
                        {m.status === "active" ? "활성" : "비활성"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 rounded-full bg-line/60 overflow-hidden">
                      <div
                        className={[
                          "h-full rounded-full",
                          expired ? "bg-red-400" : low ? "bg-amber-400" : "bg-coral",
                        ].join(" ")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink/50 whitespace-nowrap">
                      {m.done_count}/{m.total_sessions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/60">
                    <span>담당 {coachName}</span>
                    {expired ? (
                      <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 font-medium">
                        만료
                      </span>
                    ) : (
                      <span className={low ? "text-amber-600 font-medium" : ""}>
                        {low && "⚠ "}잔여 {remaining}회
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={[
                          "flex h-4 w-4 items-center justify-center rounded border",
                          m.has_next_week_session
                            ? "border-sage bg-sage text-white"
                            : "border-line text-transparent",
                        ].join(" ")}
                      >
                        ✓
                      </span>
                      <span className="text-ink/50">다음주 수업 예약</span>
                    </div>
                    <Link
                      href={`/admin/members/${m.id}/pt-log`}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full border border-coral text-coral px-2 py-0.5 text-[11px] font-medium hover:bg-coral/5 transition whitespace-nowrap"
                    >
                      PT 일지
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <SortHeader
                    label="이름"
                    active={sortKey === "name"}
                    dir={sortKey === "name" ? sortDir : "asc"}
                    onClick={() => toggleSort("name")}
                  />
                  <th className="px-5 py-3 font-medium whitespace-nowrap">담당</th>
                  <th className="px-5 py-3 font-medium whitespace-nowrap">진행</th>
                  <SortHeader
                    label="잔여"
                    active={sortKey === "remaining"}
                    dir={sortKey === "remaining" ? sortDir : "asc"}
                    onClick={() => toggleSort("remaining")}
                  />
                  <SortHeader
                    label="초/재"
                    active={sortKey === "type"}
                    dir={sortKey === "type" ? sortDir : "asc"}
                    onClick={() => toggleSort("type")}
                  />
                  <th className="px-5 py-3 font-medium whitespace-nowrap">상태</th>
                  <SortHeader
                    label="다음주"
                    active={sortKey === "nextWeek"}
                    dir={sortKey === "nextWeek" ? sortDir : "asc"}
                    onClick={() => toggleSort("nextWeek")}
                    center
                  />
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((m) => {
                  const remaining = m.total_sessions - m.done_count;
                  const pct =
                    m.total_sessions > 0
                      ? Math.min(100, Math.round((m.done_count / m.total_sessions) * 100))
                      : 0;
                  const coachName = coaches.find((c) => c.id === m.coach_id)?.name ?? "-";
                  const expired = m.total_sessions > 0 && remaining <= 0;
                  const low = !expired && remaining > 0 && remaining <= 3;
                  const goldenBell = m.status === "active" && m.total_sessions > 0 && remaining <= 3;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setDetailId(m.id)}
                      className="border-b border-line/40 last:border-0 hover:bg-bone/40 cursor-pointer transition"
                    >
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.name}
                          {m.referrer && <ReferrerBadge referrer={m.referrer} />}
                          {/* 회원 수만큼 반복 렌더링되는 링크라 prefetch를 꺼서
                              목록을 열 때마다 전원 분량의 PT일지 페이지가
                              한꺼번에 백그라운드로 조회되지 않게 한다. */}
                          <Link
                            href={`/admin/members/${m.id}/pt-log`}
                            prefetch={false}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-full border border-coral text-coral px-2 py-0.5 text-[11px] font-medium hover:bg-coral/5 transition whitespace-nowrap"
                          >
                            PT 일지
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink/70 whitespace-nowrap">{coachName}</td>
                      <td className="px-5 py-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-line/60 overflow-hidden">
                            <div
                              className={[
                                "h-full rounded-full",
                                expired ? "bg-red-400" : low ? "bg-amber-400" : "bg-coral",
                              ].join(" ")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink/50 whitespace-nowrap">
                            {m.done_count}/{m.total_sessions}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {expired ? (
                            <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                              만료
                            </span>
                          ) : (
                            <span className={low ? "text-amber-600 font-medium" : "text-ink/70"}>
                              {low && "⚠ "}
                              {remaining}회
                            </span>
                          )}
                          {goldenBell && <GoldenBellBadge />}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {m.total_sessions > 0 && <TypeBadge isFirst={m.package_count < 2} />}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={[
                            "rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap",
                            m.status === "active"
                              ? "bg-sage/20 text-sage"
                              : "bg-line/40 text-ink/50",
                          ].join(" ")}
                        >
                          {m.status === "active" ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={[
                            "inline-flex h-4 w-4 items-center justify-center rounded border text-xs",
                            m.has_next_week_session
                              ? "border-sage bg-sage text-white"
                              : "border-line text-transparent",
                          ].join(" ")}
                          title={m.has_next_week_session ? "다음주 수업 예약됨" : "다음주 예약 없음"}
                        >
                          ✓
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FixedSlotSchedule
        fixedSlots={fixedSlots}
        members={members}
        coaches={coaches}
        coachFilter={coachFilter}
        coachName={
          coachFilter === "all"
            ? null
            : coachFilter === "unassigned"
              ? "미지정"
              : coaches.find((c) => c.id === coachFilter)?.name ?? null
        }
        onChanged={refresh}
      />

      {showCreate && (
        <CreateMemberModal
          coaches={activeCoaches}
          onClose={() => setShowCreate(false)}
          onCreated={(memberId) => {
            // 등록을 마치자마자 방금 만든 계약서를 바로 확인할 수 있도록 상세
            // 모달 + 계약서 보기를 연 상태로 이동한다.
            window.location.href = `/admin/members?open=${memberId}&contract=1`;
          }}
        />
      )}

      {detailId &&
        (() => {
          const detailMember = members.find((m) => m.id === detailId);
          if (!detailMember) return null;
          return (
            <MemberDetailModal
              memberId={detailId}
              initialMember={detailMember}
              coaches={coaches}
              activeCoaches={activeCoaches}
              fixedSlots={fixedSlots.filter((f) => f.member_id === detailId)}
              onClose={() => {
                setDetailId(null);
                setInitialContractConsumed(true);
              }}
              onChanged={refresh}
              // 계약서 화면으로 바로 열기(초기 URL의 ?contract=1)는 그 딥링크가
              // 가리킨 회원(initialOpenId)에만, 그것도 딱 한 번만 적용한다. 그
              // 상태로 목록에서 다른 회원 행을 눌러도 페이지 prop은 그대로라,
              // 매칭만 확인하면 같은 회원을 다시 열 때마다(모달을 닫았다 다시
              // 열어도) 계약서 화면부터 계속 재발생하는 문제가 있었다.
              initialShowContractView={
                detailId === initialOpenId && !initialContractConsumed
                  ? initialShowContractView
                  : false
              }
            />
          );
        })()}
    </div>
  );
}

function FixedSlotSchedule({
  fixedSlots,
  members,
  coaches,
  coachFilter,
  coachName,
  onChanged,
}: {
  fixedSlots: FixedSlotWithMember[];
  members: MemberWithProgress[];
  coaches: CoachRow[];
  coachFilter: number | "all" | "unassigned";
  coachName: string | null;
  onChanged: () => void;
}) {
  // 코치별 색상은 전체 코치 목록 기준 순서로 고정해, 스케줄표와도 같은 코치가
  // 항상 같은 색을 쓰도록 한다(스케줄표의 코치 색상 팔레트와 동일한 로직).
  const coachColorMap = useMemo(() => {
    const map = new Map<number, CoachColorStyle>();
    coaches.forEach((c, i) => {
      map.set(c.id, COACH_COLOR_PALETTE[i % COACH_COLOR_PALETTE.length]);
    });
    return map;
  }, [coaches]);

  const scopedSlots = useMemo(() => {
    if (coachFilter === "all") return fixedSlots;
    if (coachFilter === "unassigned") {
      return fixedSlots.filter((slot) => slot.member_coach_id === null);
    }
    return fixedSlots.filter((slot) => slot.member_coach_id === coachFilter);
  }, [fixedSlots, coachFilter]);

  const byCell = useMemo(() => {
    const map = new Map<string, Array<{ name: string; coachId: number | null }>>();
    for (const slot of scopedSlots) {
      const key = `${slot.weekday}-${slot.hour}`;
      const entries = map.get(key) ?? [];
      entries.push({ name: slot.member_name, coachId: slot.member_coach_id });
      map.set(key, entries);
    }
    return map;
  }, [scopedSlots]);

  // 클릭해서 회원을 배정/제거할 때는 현재 보기 필터(coachFilter)와 무관하게
  // 그 시간대의 실제 전체 배정 현황을 알아야 하므로, 필터링 전 fixedSlots
  // 기준으로 따로 모은다.
  const allByCell = useMemo(() => {
    const map = new Map<string, Array<{ id: number; memberId: number; name: string }>>();
    for (const slot of fixedSlots) {
      const key = `${slot.weekday}-${slot.hour}`;
      const entries = map.get(key) ?? [];
      entries.push({ id: slot.id, memberId: slot.member_id, name: slot.member_name });
      map.set(key, entries);
    }
    return map;
  }, [fixedSlots]);

  const [pickerCell, setPickerCell] = useState<{ weekday: number; hour: number } | null>(null);
  const [pickerMemberId, setPickerMemberId] = useState<number | "">("");
  const [pickerSaving, setPickerSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  function openPicker(weekday: number, hour: number) {
    setPickerCell({ weekday, hour });
    setPickerMemberId("");
    setPickerError(null);
  }

  async function addPickerSlot() {
    if (!pickerCell || pickerMemberId === "") return;
    setPickerSaving(true);
    setPickerError(null);
    try {
      const res = await fetch("/api/admin/fixed-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: pickerMemberId,
          weekday: pickerCell.weekday,
          hour: pickerCell.hour,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPickerError(d.error ?? "추가에 실패했습니다.");
        return;
      }
      const created = d.created ?? 0;
      const skippedDates: string[] = d.skippedDates ?? [];
      if (created > 0 || skippedDates.length > 0) {
        let message = created > 0 ? `스케줄표에 ${created}건 자동 예약됐어요.` : "";
        if (skippedDates.length > 0) {
          message +=
            (message ? "\n" : "") +
            `${skippedDates.length}건은 이미 다른 예약이 있어 건너뛰었어요: ${skippedDates.join(", ")}`;
        }
        alert(message);
      }
      onChanged();
    } finally {
      setPickerSaving(false);
    }
  }

  async function removePickerSlot(id: number) {
    setPickerSaving(true);
    try {
      await fetch(`/api/admin/fixed-slots/${id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setPickerSaving(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-display text-lg">
          {coachName ? `${coachName} 코치 고정 회원 시간표` : "고정 회원 시간표"}
        </p>
        <span className="text-xs text-ink/40">시간대별 고정 회원 배정 현황</span>
      </div>
      <p className="text-xs text-ink/40 mb-3">
        한 시간대에는 회원 한 명만 배정할 수 있어요. 기존에 중복 배정된 시간대는 옅은 붉은색 칸으로 표시돼요.
      </p>
      {coachFilter === "all" && coaches.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 text-xs text-ink/60">
          {coaches.map((c) => {
            const style = coachColorMap.get(c.id);
            return (
              <span key={c.id} className="flex items-center gap-1.5">
                <span
                  className={["inline-block h-2.5 w-2.5 rounded-full", style?.header ?? "bg-sage/15"].join(" ")}
                />
                {c.name}
              </span>
            );
          })}
        </div>
      )}
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full table-fixed text-xs min-w-[720px] border-collapse">
          <thead>
            <tr className="text-left text-ink/50 border-b border-line/60">
              <th className="px-3 py-2.5 font-medium w-14">시간</th>
              {FIXED_SLOT_WEEKDAY_LABELS.map((label) => (
                <th key={label} className="px-3 py-2.5 font-medium text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_HOUR_ROWS.map((hour) => {
              return (
              <tr key={hour} className="border-b border-line/30 last:border-0">
                <td className="px-3 py-2.5 text-ink/50 whitespace-nowrap">{hour}시</td>
                {FIXED_SLOT_WEEKDAY_LABELS.map((_, weekday) => {
                  const entries = byCell.get(`${weekday}-${hour}`) ?? [];
                  // "전체" 보기에서는 같은 시간대에 코치마다 자기 회원이 있는 게 당연하니
                  // 겹침으로 보지 않는다. 한 코치가 겹치게 배정된 경우에만 표시한다.
                  const over = coachFilter !== "all" && entries.length > FIXED_SLOT_CAPACITY;
                  return (
                    <td
                      key={weekday}
                      onClick={() => openPicker(weekday, hour)}
                      className="px-3 py-2.5 align-top cursor-pointer hover:bg-bone/50 transition"
                    >
                      {entries.length > 0 && (
                        <div
                          className={[
                            "flex flex-wrap justify-center gap-1 rounded-lg px-1.5 py-1",
                            over ? "bg-red-50" : "",
                          ].join(" ")}
                        >
                          {entries.map((entry, i) => {
                            // 중복 배정된 칸이어도 배지 자체는 담당 코치 색을 그대로 유지해서
                            // "어느 코치의 회원끼리 겹쳤는지"를 한눈에 구분할 수 있게 한다.
                            // 겹쳤다는 사실 자체는 칸 배경(bg-red-50)만으로 표시한다.
                            const coachStyle =
                              entry.coachId != null ? coachColorMap.get(entry.coachId) : undefined;
                            const pillClass = coachStyle
                              ? `${coachStyle.header} ${coachStyle.headerText}`
                              : "bg-sage/15 text-ink/70";
                            return (
                              <span
                                key={`${entry.name}-${i}`}
                                className={["rounded-full px-1.5 py-0.5 whitespace-nowrap", pillClass].join(" ")}
                              >
                                {entry.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pickerCell &&
        (() => {
          const key = `${pickerCell.weekday}-${pickerCell.hour}`;
          const current = allByCell.get(key) ?? [];
          const availableMembers = members
            .filter((m) => m.status === "active")
            .filter((m) => {
              if (coachFilter === "unassigned") return m.coach_id === null;
              if (coachFilter === "all") return true;
              return m.coach_id === coachFilter;
            })
            .filter((m) => !current.some((entry) => entry.memberId === m.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <ModalShell
              title={`${FIXED_SLOT_WEEKDAY_LABELS[pickerCell.weekday]}요일 ${pickerCell.hour}시`}
              onClose={() => setPickerCell(null)}
            >
              <div className="space-y-3">
                {current.length > 0 ? (
                  <div className="space-y-1.5">
                    {current.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-line/60 px-3 py-2 text-sm"
                      >
                        <span>{entry.name}</span>
                        <button
                          type="button"
                          disabled={pickerSaving}
                          onClick={() => removePickerSlot(entry.id)}
                          className="text-xs text-coral hover:opacity-70 disabled:opacity-50"
                        >
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink/40">아직 배정된 회원이 없어요.</p>
                )}

                <div className="flex items-center gap-2">
                  <select
                    value={pickerMemberId}
                    onChange={(e) => setPickerMemberId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="flex-1 min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
                  >
                    <option value="">회원 선택</option>
                    {availableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pickerSaving || pickerMemberId === ""}
                    onClick={addPickerSlot}
                    className="shrink-0 rounded-full bg-coral text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
                {pickerError && <p className="text-sm text-coral">{pickerError}</p>}
              </div>
            </ModalShell>
          );
        })()}
    </div>
  );
}

function ContractFieldsFieldset({
  rrnFront,
  onRrnFrontChange,
  address,
  onAddressChange,
  visitChannel,
  onVisitChannelChange,
  visitChannelReferrerName,
  onVisitChannelReferrerNameChange,
  visitChannelOther,
  onVisitChannelOtherChange,
  purposes,
  onTogglePurpose,
  purposeOther,
  onPurposeOtherChange,
  startDate,
  onStartDateChange,
  optionNote,
  onOptionNoteChange,
  privacyConsent,
  onPrivacyConsentChange,
  showVisitChannel = true,
  showPurpose = true,
  showOptionNote = true,
}: {
  rrnFront: string;
  onRrnFrontChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  visitChannel: VisitChannel;
  onVisitChannelChange: (v: VisitChannel) => void;
  visitChannelReferrerName: string;
  onVisitChannelReferrerNameChange: (v: string) => void;
  visitChannelOther: string;
  onVisitChannelOtherChange: (v: string) => void;
  purposes: string[];
  onTogglePurpose: (v: string) => void;
  purposeOther: string;
  onPurposeOtherChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  optionNote: string;
  onOptionNoteChange: (v: string) => void;
  privacyConsent: boolean;
  onPrivacyConsentChange: (v: boolean) => void;
  /** 초진 문진표에서 이미 방문경로를 수집하는 흐름에서는 여기서 숨긴다. */
  showVisitChannel?: boolean;
  /** 운동 목적을 별도 자유입력 textarea로 이미 받는 흐름에서는 태그형 운동 목표를 숨긴다. */
  showPurpose?: boolean;
  /** 옵션을 다른 위치에서 별도로 렌더링하는 흐름(신규 회원 등록)에서는 여기서 숨긴다. */
  showOptionNote?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="주민등록번호 (앞자리)">
          <input
            value={rrnFront}
            onChange={(e) => onRrnFrontChange(e.target.value)}
            placeholder="예: 900101"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="주소">
          <input
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
      </div>
      {showVisitChannel && (
        <Field label="방문 경로">
          <div className="flex flex-wrap gap-1.5">
            {VISIT_CHANNEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onVisitChannelChange(opt.value)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                  visitChannel === opt.value
                    ? "bg-coral text-white border-coral"
                    : "border-line text-ink/60 hover:bg-bone",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {visitChannel === "referral" && (
            <input
              value={visitChannelReferrerName}
              onChange={(e) => onVisitChannelReferrerNameChange(e.target.value)}
              placeholder="소개해주신 분 이름"
              className="w-full mt-2 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          )}
          {visitChannel === "other" && (
            <input
              value={visitChannelOther}
              onChange={(e) => onVisitChannelOtherChange(e.target.value)}
              placeholder="경로를 입력해주세요"
              className="w-full mt-2 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          )}
        </Field>
      )}
      {showPurpose && (
        <Field label="운동 목표">
          <div className="flex flex-wrap gap-1.5">
            {PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTogglePurpose(opt.value)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                  purposes.includes(opt.value)
                    ? "bg-coral text-white border-coral"
                    : "border-line text-ink/60 hover:bg-bone",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            value={purposeOther}
            onChange={(e) => onPurposeOtherChange(e.target.value)}
            placeholder="기타 (선택 입력)"
            className="w-full mt-2 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
      )}
      <div className={showOptionNote ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : undefined}>
        <Field label="운동 시작일">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        {showOptionNote && (
          <Field label="옵션">
            <input
              value={optionNote}
              onChange={(e) => onOptionNoteChange(e.target.value)}
              placeholder="선택 입력"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={privacyConsent}
          onChange={(e) => onPrivacyConsentChange(e.target.checked)}
        />
        개인정보(민감정보 포함) 수집·이용에 동의합니다.
      </label>
    </>
  );
}

function CreateMemberModal({
  coaches,
  onClose,
  onCreated,
}: {
  coaches: CoachRow[];
  onClose: () => void;
  onCreated: (memberId: number) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companionName, setCompanionName] = useState("");
  const [companionPhone, setCompanionPhone] = useState("");
  const [companionRrnFront, setCompanionRrnFront] = useState("");
  const [companionAddress, setCompanionAddress] = useState("");
  const [companionPrivacyConsent, setCompanionPrivacyConsent] = useState(false);
  const [coachId, setCoachId] = useState<number | "">(coaches[0]?.id ?? "");
  const [referrer, setReferrer] = useState("");
  const [availableTimes, setAvailableTimes] = useState("");
  const [notes, setNotes] = useState("");
  const [ptType, setPtType] = useState<PtType>("1:1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [totalSessions, setTotalSessions] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 계약서 전용 항목
  const [rrnFront, setRrnFront] = useState("");
  const [address, setAddress] = useState("");
  const [visitChannel, setVisitChannel] = useState<VisitChannel>("");
  const [visitChannelReferrerName, setVisitChannelReferrerName] = useState("");
  const [visitChannelOther, setVisitChannelOther] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [purposeOther, setPurposeOther] = useState("");
  const [optionNote, setOptionNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // 고정 시간대 — 아직 회원이 만들어지기 전이라 바로 저장할 수 없으므로, 등록
  // 버튼을 누를 때까지는 로컬에만 담아뒀다가 회원 생성이 끝난 뒤 한꺼번에 등록한다.
  const [newFixedSlots, setNewFixedSlots] = useState<{ weekday: number; hour: number }[]>([]);
  const [newSlotWeekday, setNewSlotWeekday] = useState(0);
  const [newSlotHour, setNewSlotHour] = useState(SCHEDULE_HOUR_ROWS[0]);

  function addFixedSlotDraft() {
    if (newFixedSlots.some((s) => s.weekday === newSlotWeekday && s.hour === newSlotHour)) return;
    setNewFixedSlots((prev) => [...prev, { weekday: newSlotWeekday, hour: newSlotHour }]);
  }

  function removeFixedSlotDraft(weekday: number, hour: number) {
    setNewFixedSlots((prev) => prev.filter((s) => !(s.weekday === weekday && s.hour === hour)));
  }

  function togglePurpose(value: string) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!totalSessions || Number(totalSessions) < 1) {
      setError("등록 횟수를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          coachId: coachId === "" ? null : coachId,
          notes,
          referrer,
          availableTimes,
          totalSessions: Number(totalSessions),
          price: Number(price || 0),
          ptType,
          paymentMethod,
          rrnFront,
          address,
          visitChannel,
          visitChannelReferrerName,
          visitChannelOther,
          purposes,
          purposeOther,
          optionNote,
          startDate,
          privacyConsent,
          companionName: ptType === "2:1" ? companionName : "",
          companionPhone: ptType === "2:1" ? companionPhone : "",
          companionRrnFront: ptType === "2:1" ? companionRrnFront : "",
          companionAddress: ptType === "2:1" ? companionAddress : "",
          companionPrivacyConsent: ptType === "2:1" ? companionPrivacyConsent : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      for (const slot of newFixedSlots) {
        await fetch("/api/admin/fixed-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: data.member.id, weekday: slot.weekday, hour: slot.hour }),
        });
      }
      onCreated(data.member.id);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="신규 회원 등록" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line/60 bg-bone/30 px-4 py-3 space-y-3">
          <p className="text-sm font-medium text-ink/70">계약서 정보</p>
          <Field label="이름 *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
          <Field label="연락처">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
          <ContractFieldsFieldset
            rrnFront={rrnFront}
            onRrnFrontChange={setRrnFront}
            address={address}
            onAddressChange={setAddress}
            visitChannel={visitChannel}
            onVisitChannelChange={setVisitChannel}
            visitChannelReferrerName={visitChannelReferrerName}
            onVisitChannelReferrerNameChange={setVisitChannelReferrerName}
            visitChannelOther={visitChannelOther}
            onVisitChannelOtherChange={setVisitChannelOther}
            purposes={purposes}
            onTogglePurpose={togglePurpose}
            purposeOther={purposeOther}
            onPurposeOtherChange={setPurposeOther}
            startDate={startDate}
            onStartDateChange={setStartDate}
            optionNote={optionNote}
            onOptionNoteChange={setOptionNote}
            privacyConsent={privacyConsent}
            onPrivacyConsentChange={setPrivacyConsent}
            showPurpose={false}
            showOptionNote={false}
          />
        </div>

        <Field label="PT 유형">
          <PtTypeToggle value={ptType} onChange={setPtType} />
        </Field>
        {ptType === "2:1" && (
          <div className="rounded-xl border border-line/60 bg-bone/30 px-4 py-3 space-y-3">
            <p className="text-xs text-ink/50">
              2:1 수업이라 함께 등록하는 분의 인적사항도 계약서에 함께 기록돼요. (별도
              회원으로 등록되지는 않아요.)
            </p>
            <Field label="함께 등록하는 분 이름">
              <input
                value={companionName}
                onChange={(e) => setCompanionName(e.target.value)}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 연락처">
              <input
                value={companionPhone}
                onChange={(e) => setCompanionPhone(e.target.value)}
                placeholder="010-"
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 주민등록번호 (앞자리)">
              <input
                value={companionRrnFront}
                onChange={(e) => setCompanionRrnFront(e.target.value)}
                placeholder="예: 900101"
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 주소">
              <input
                value={companionAddress}
                onChange={(e) => setCompanionAddress(e.target.value)}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={companionPrivacyConsent}
                onChange={(e) => setCompanionPrivacyConsent(e.target.checked)}
              />
              함께 등록하는 분 개인정보(민감정보 포함) 수집·이용에 동의합니다.
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="담당 코치">
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none"
            >
              <option value="">미지정</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="소개해주신 분">
            <input
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="선택 입력"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        </div>
        <Field label="가능한 요일·시간">
          <input
            value={availableTimes}
            onChange={(e) => setAvailableTimes(e.target.value)}
            placeholder="예: 화·목 오전 10시"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral mb-2"
          />
          <AvailabilityGridPicker onChange={setAvailableTimes} lockable />
        </Field>
        <div>
          <p className="text-sm font-medium mb-2">고정 시간대</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {newFixedSlots.length === 0 && (
              <p className="text-xs text-ink/40">등록된 고정 시간대가 없어요.</p>
            )}
            {newFixedSlots.map((slot) => (
              <span
                key={`${slot.weekday}-${slot.hour}`}
                className="flex items-center gap-1 rounded-full bg-bone/70 px-2.5 py-1 text-xs"
              >
                {FIXED_SLOT_WEEKDAY_LABELS[slot.weekday] ?? "?"} {slot.hour}시
                <button
                  type="button"
                  onClick={() => removeFixedSlotDraft(slot.weekday, slot.hour)}
                  className="text-ink/40 hover:text-coral"
                  aria-label="삭제"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={newSlotWeekday}
              onChange={(e) => setNewSlotWeekday(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {FIXED_SLOT_WEEKDAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={newSlotHour}
              onChange={(e) => setNewSlotHour(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {SCHEDULE_HOUR_ROWS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}시
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addFixedSlotDraft}
              className="flex-1 rounded-lg border border-coral text-coral text-sm font-medium hover:bg-coral/5 transition"
            >
              추가
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="등록 횟수 *">
            <input
              type="number"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
              placeholder="예: 30"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
          <Field label="결제 금액">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 1700000"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        </div>
        <Field label="옵션">
          <input
            value={optionNote}
            onChange={(e) => setOptionNote(e.target.value)}
            placeholder="할인 내용"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="결제 수단">
          <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
        </Field>
        <Field label="운동 목적 / 특이사항">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral resize-none"
          />
        </Field>

        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "등록"}
        </button>
      </div>
    </ModalShell>
  );
}

function WriteContractModal({
  memberId,
  latestPackage,
  onClose,
  onCreated,
}: {
  memberId: number;
  latestPackage: PackageRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rrnFront, setRrnFront] = useState("");
  const [address, setAddress] = useState("");
  const [visitChannel, setVisitChannel] = useState<VisitChannel>("");
  const [visitChannelReferrerName, setVisitChannelReferrerName] = useState("");
  const [visitChannelOther, setVisitChannelOther] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [purposeOther, setPurposeOther] = useState("");
  const [optionNote, setOptionNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [companionPhone, setCompanionPhone] = useState("");
  const [companionRrnFront, setCompanionRrnFront] = useState("");
  const [companionAddress, setCompanionAddress] = useState("");
  const [companionPrivacyConsent, setCompanionPrivacyConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePurpose(value: string) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rrnFront,
          address,
          visitChannel,
          visitChannelReferrerName,
          visitChannelOther,
          purposes,
          purposeOther,
          optionNote,
          startDate,
          privacyConsent,
          companionName,
          companionPhone,
          companionRrnFront,
          companionAddress,
          companionPrivacyConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "계약서 작성에 실패했습니다.");
        return;
      }
      onCreated();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="계약서 작성" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm">
          <p className="text-xs text-ink/50 mb-1">회원권 정보 (최근 패키지 자동 반영)</p>
          <p>
            {latestPackage.pt_type} · {latestPackage.total_sessions}회 ·{" "}
            {formatWon(latestPackage.price)} · {PAYMENT_METHOD_LABELS[latestPackage.payment_method]}
          </p>
        </div>
        {latestPackage.pt_type === "2:1" && (
          <div className="rounded-xl border border-line/60 bg-bone/30 px-4 py-3 space-y-3">
            <p className="text-xs text-ink/50">
              2:1 수업이라 함께 등록하는 분의 인적사항도 계약서에 함께 기록돼요. (별도
              회원으로 등록되지는 않아요.)
            </p>
            <Field label="함께 등록하는 분 이름">
              <input
                value={companionName}
                onChange={(e) => setCompanionName(e.target.value)}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 연락처">
              <input
                value={companionPhone}
                onChange={(e) => setCompanionPhone(e.target.value)}
                placeholder="010-"
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 주민등록번호 (앞자리)">
              <input
                value={companionRrnFront}
                onChange={(e) => setCompanionRrnFront(e.target.value)}
                placeholder="예: 900101"
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <Field label="함께 등록하는 분 주소">
              <input
                value={companionAddress}
                onChange={(e) => setCompanionAddress(e.target.value)}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={companionPrivacyConsent}
                onChange={(e) => setCompanionPrivacyConsent(e.target.checked)}
              />
              함께 등록하는 분 개인정보(민감정보 포함) 수집·이용에 동의합니다.
            </label>
          </div>
        )}
        <ContractFieldsFieldset
          rrnFront={rrnFront}
          onRrnFrontChange={setRrnFront}
          address={address}
          onAddressChange={setAddress}
          visitChannel={visitChannel}
          onVisitChannelChange={setVisitChannel}
          visitChannelReferrerName={visitChannelReferrerName}
          onVisitChannelReferrerNameChange={setVisitChannelReferrerName}
          visitChannelOther={visitChannelOther}
          onVisitChannelOtherChange={setVisitChannelOther}
          purposes={purposes}
          onTogglePurpose={togglePurpose}
          purposeOther={purposeOther}
          onPurposeOtherChange={setPurposeOther}
          startDate={startDate}
          onStartDateChange={setStartDate}
          optionNote={optionNote}
          onOptionNoteChange={setOptionNote}
          privacyConsent={privacyConsent}
          onPrivacyConsentChange={setPrivacyConsent}
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "계약서 작성 완료"}
        </button>
      </div>
    </ModalShell>
  );
}

function ContractViewModal({
  memberId,
  onClose,
  onSigned,
}: {
  memberId: number;
  onClose: () => void;
  onSigned?: () => void;
}) {
  const [data, setData] = useState<{
    member: { name: string; phone: string };
    contract: ContractRow & { rrn_front: string; companion_rrn_front: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/members/${memberId}/contract`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(d.error ?? "계약서를 불러오지 못했어요.");
          return;
        }
        setData(d);
      })
      .catch(() => setError("네트워크 오류가 발생했어요."));
  }

  useEffect(load, [memberId]);

  function handleSigned() {
    onSigned?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl p-6 sm:p-10 my-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">계약서</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        {!data && !error && <p className="text-sm text-ink/50">불러오는 중...</p>}
        {data && (
          <ContractDocument
            memberName={data.member.name}
            memberPhone={data.member.phone}
            contract={data.contract}
          >
            {data.contract.signed_at ? (
              <div className="rounded-2xl border border-sage/40 bg-sage/10 px-6 py-6">
                <p className="font-display text-lg mb-3">회원 서명</p>
                {data.contract.signature_data_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.contract.signature_data_url}
                    alt="회원 서명"
                    className="h-32 rounded-lg border border-line bg-white"
                  />
                )}
                <p className="text-xs text-ink/50 mt-2">
                  {formatDateTime(data.contract.signed_at)} 서명 완료
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-ink/50 mb-3">
                  아직 서명 전이에요. 회원이 매장에 방문했다면 아래에서 바로 서명받을 수
                  있고, 회원 개인 페이지에서 직접 서명할 수도 있어요.
                </p>
                <SignaturePad
                  signUrl={`/api/admin/members/${memberId}/contract/sign`}
                  onSigned={handleSigned}
                />
              </div>
            )}
          </ContractDocument>
        )}
      </div>
    </div>
  );
}

function MemberDetailModal({
  memberId,
  initialMember,
  coaches,
  activeCoaches,
  fixedSlots,
  onClose,
  onChanged,
  initialShowContractView,
}: {
  memberId: number;
  initialMember: MemberWithProgress;
  coaches: CoachRow[];
  activeCoaches: CoachRow[];
  fixedSlots: FixedSlotWithMember[];
  onClose: () => void;
  onChanged: () => void;
  initialShowContractView?: boolean;
}) {
  const [newSlotWeekday, setNewSlotWeekday] = useState(0);
  const [newSlotHour, setNewSlotHour] = useState(SCHEDULE_HOUR_ROWS[0]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [showWriteContract, setShowWriteContract] = useState(false);
  const [showContractView, setShowContractView] = useState(!!initialShowContractView);
  // 삭제류 동작은 브라우저 기본 confirm() 대신 이 상태로 재확인 모달을 띄운다.
  // iOS에서 "홈 화면에 추가"로 설치한 PWA(standalone) 모드에서는 window.confirm이
  // 동작하지 않거나 무시돼서, 실수로 되돌릴 수 없는 삭제가 바로 일어나는 문제가 있었다.
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(
    null,
  );
  // 환불 검토 패널 — 계산된 금액 내역을 보여주고 "완료"를 눌러야 실제로 환불+삭제가
  // 일어난다(즉시 삭제되지 않도록).
  const [refundState, setRefundState] = useState<ReturnType<typeof computeRefund> | null>(null);

  async function addSlot() {
    if (!data?.member.coach_id) {
      setSlotError("담당 코치를 먼저 지정해주세요.");
      return;
    }
    setSavingSlot(true);
    setSlotError(null);
    try {
      const res = await fetch("/api/admin/fixed-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, weekday: newSlotWeekday, hour: newSlotHour }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSlotError(d.error ?? "추가에 실패했습니다.");
        return;
      }
      const created = d.created ?? 0;
      const skippedDates: string[] = d.skippedDates ?? [];
      if (created > 0 || skippedDates.length > 0) {
        let message = created > 0 ? `스케줄표에 ${created}건 자동 예약됐어요.` : "";
        if (skippedDates.length > 0) {
          message +=
            (message ? "\n" : "") +
            `${skippedDates.length}건은 이미 다른 예약이 있어 건너뛰었어요: ${skippedDates.join(", ")}`;
        }
        alert(message);
      }
      onChanged();
    } finally {
      setSavingSlot(false);
    }
  }

  async function removeSlot(id: number) {
    await fetch(`/api/admin/fixed-slots/${id}`, { method: "DELETE" });
    onChanged();
  }
  // 목록에서 이미 알고 있는 회원 기본 정보(이름·연락처·담당·상태·소개자·가능시간·메모·개인
  // 예약 링크)는 곧바로 채워 넣어, 모달을 열자마자 편집 폼이 보이게 한다. 목록에는 없는
  // 패키지·세션·계약서·평가 기록 요약만 아래 useEffect의 백그라운드 조회로 채운다.
  const [data, setData] = useState<{
    member: MemberDetail;
    progress: { totalSessions: number; doneCount: number; remaining: number };
    packages: PackageRow[];
    sessions: SessionSummary[];
    contract: { id: number; entryType: string; signedAt: string | null } | null;
    assessmentSummary: { count: number; latestAt: string | null };
  }>({
    member: initialMember,
    progress: {
      totalSessions: initialMember.total_sessions,
      doneCount: initialMember.done_count,
      remaining: initialMember.total_sessions - initialMember.done_count,
    },
    packages: [],
    sessions: [],
    contract: null,
    assessmentSummary: { count: 0, latestAt: null },
  });
  const [detailLoading, setDetailLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [addSessions, setAddSessions] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addPtType, setAddPtType] = useState<PtType>("1:1");
  const [addPaymentMethod, setAddPaymentMethod] = useState<PaymentMethod>("card");
  const [addOptionNote, setAddOptionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 편집 폼 상태 — 이미 목록에 있는 값으로 즉시 초기화한다.
  const [name, setName] = useState(initialMember.name);
  const [phone, setPhone] = useState(initialMember.phone);
  const [coachId, setCoachId] = useState<number | "">(initialMember.coach_id ?? "");
  const [status, setStatus] = useState<MemberStatus>(initialMember.status);
  const [referrer, setReferrer] = useState(initialMember.referrer);
  const [availableTimes, setAvailableTimes] = useState(initialMember.available_times);
  const [notes, setNotes] = useState(initialMember.notes);

  const [editingPkgId, setEditingPkgId] = useState<number | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPtType, setEditPtType] = useState<PtType>("1:1");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("card");

  // 이름/연락처 등 편집 폼 값은 이미 목록에서 받은 값으로 채워둔 상태라 여기서 다시 덮어쓰지
  // 않는다(관리자가 응답이 오기 전에 입력을 시작했다면 그 값을 유지하기 위함) — 패키지·세션·
  // 계약서·평가 기록 요약만 이 응답으로 채운다.
  useEffect(() => {
    fetch(`/api/admin/members/${memberId}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setDetailLoading(false));
  }, [memberId]);

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/my/${data.member.token}` : "";

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          coachId: coachId === "" ? null : coachId,
          status,
          referrer,
          availableTimes,
          notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "저장에 실패했습니다.");
        return;
      }

      // 결제·패키지 이력의 횟수를 입력해둔 채로 하단 저장 버튼을 눌러도(별도로
      // "+ 재등록/패키지 추가"를 누르지 않아도) 결제 내역이 함께 저장되도록 한다.
      if (addSessions && Number(addSessions) >= 1) {
        const pkgRes = await fetch(`/api/admin/members/${memberId}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalSessions: Number(addSessions),
            price: Number(addPrice || 0),
            ptType: addPtType,
            paymentMethod: addPaymentMethod,
            note: addOptionNote,
          }),
        });
        if (!pkgRes.ok) {
          const d = await pkgRes.json().catch(() => ({}));
          setError(d.error ?? "결제 내역 저장에 실패했습니다.");
          return;
        }
      }

      onChanged();

      // 패키지는 있는데 계약서가 아직 없으면 저장 직후 바로 계약서 작성을 이어서
      // 받는다. 계약서가 이미 작성돼 있으면 다시 띄우지 않고 그대로 창을 닫는다.
      const refreshed = await fetch(`/api/admin/members/${memberId}`).then((r) => r.json());
      setData(refreshed);
      if (!refreshed.contract && refreshed.packages.length > 0) {
        setShowWriteContract(true);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteMember() {
    setConfirmState({
      message:
        `${data!.member.name} 회원을 완전히 삭제할까요? 되돌릴 수 없어요.\n\n` +
        `PT 예약 내역과 결제 내역은 정산 기록으로 남고, 계약서·평가지·PT일지·` +
        `문진표와 앞으로 예정된 예약은 함께 삭제돼요.`,
      onConfirm: doDeleteMember,
    });
  }

  async function doDeleteMember() {
    setConfirmState(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "삭제에 실패했습니다.");
        return;
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleRefundClick() {
    if (!latestPackage) return;
    setRefundState(computeRefund(latestPackage, data.progress));
  }

  async function doRefundAndDelete() {
    if (!refundState) return;
    const { refundAmount } = refundState;
    setRefundState(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "환불 처리에 실패했습니다.");
        return;
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPackage() {
    if (!addSessions || Number(addSessions) < 1) {
      setError("추가할 횟수를 입력해주세요.");
      return;
    }
    const res = await fetch(`/api/admin/members/${memberId}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalSessions: Number(addSessions),
        price: Number(addPrice || 0),
        ptType: addPtType,
        paymentMethod: addPaymentMethod,
        note: addOptionNote,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가에 실패했습니다.");
      return;
    }
    setAddSessions("");
    setAddPrice("");
    setAddPtType("1:1");
    setAddPaymentMethod("card");
    setAddOptionNote("");
    onChanged();
    onClose();
  }

  function startEditPkg(pkg: PackageRow) {
    setEditingPkgId(pkg.id);
    setEditTotal(String(pkg.total_sessions));
    setEditPrice(String(pkg.price));
    setEditNote(pkg.note);
    setEditPtType(pkg.pt_type);
    setEditPaymentMethod(pkg.payment_method);
  }

  async function saveEditPkg(pkgId: number) {
    const totalSessions = Number(editTotal);
    const price = Number(editPrice);
    if (!Number.isInteger(totalSessions) || totalSessions < 1) {
      setError("횟수를 올바르게 입력해주세요.");
      return;
    }
    const res = await fetch(`/api/admin/members/${memberId}/packages/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalSessions,
        price,
        note: editNote,
        ptType: editPtType,
        paymentMethod: editPaymentMethod,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "수정에 실패했습니다.");
      return;
    }
    setEditingPkgId(null);
    const refreshed = await fetch(`/api/admin/members/${memberId}`).then((r) => r.json());
    setData(refreshed);
    onChanged();
  }

  function deletePkg(pkgId: number) {
    setConfirmState({
      message: "이 결제 기록을 삭제할까요?",
      onConfirm: () => doDeletePkg(pkgId),
    });
  }

  async function doDeletePkg(pkgId: number) {
    setConfirmState(null);
    const res = await fetch(`/api/admin/members/${memberId}/packages/${pkgId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("삭제에 실패했습니다.");
      return;
    }
    const refreshed = await fetch(`/api/admin/members/${memberId}`).then((r) => r.json());
    setData(refreshed);
    onChanged();
  }

  const firstPackageId = data.packages[0]?.id;
  const latestPackage = data.packages[data.packages.length - 1];

  return (
    <>
    <ModalShell title={`${data.member.name} — 회원 정보`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span>
            진행 {data.progress.doneCount} / {data.progress.totalSessions} (잔여{" "}
            {data.progress.remaining}회)
          </span>
          {data.contract ? (
            <button
              onClick={() => setShowContractView(true)}
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition hover:opacity-80",
                data.contract.signedAt ? "bg-sage/20 text-sage" : "bg-coral/10 text-coral",
              ].join(" ")}
            >
              계약서 {data.contract.signedAt ? "서명완료" : "서명대기"} · 보기
            </button>
          ) : (
            data.packages.length > 0 && (
              <button
                onClick={() => setShowWriteContract(true)}
                className="rounded-full border border-coral text-coral px-2.5 py-0.5 text-xs font-medium hover:bg-coral/5 transition whitespace-nowrap"
              >
                + 계약서 작성
              </button>
            )
          )}
        </div>

        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span>
            체형 평가{" "}
            {detailLoading
              ? "불러오는 중..."
              : data.assessmentSummary.count > 0
                ? `${data.assessmentSummary.count}건 · 최근 ${data.assessmentSummary.latestAt}`
                : "기록 없음"}
          </span>
          <Link
            href={`/admin/members/${memberId}/assessment`}
            className="rounded-full border border-coral text-coral px-2.5 py-0.5 text-xs font-medium hover:bg-coral/5 transition whitespace-nowrap"
          >
            {data.assessmentSummary.count > 0 ? "평가 기록" : "+ 평가 작성"}
          </Link>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">개인 예약 링크</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink/60 bg-bone/30"
            />
            <button
              onClick={copyLink}
              className="rounded-lg border border-line px-3 py-2 text-xs hover:bg-bone transition whitespace-nowrap"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <p className="text-[11px] text-ink/40 mt-1">
            이 링크는 본인만 확인 가능하며 다른 회원 이름은 노출되지 않습니다.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름 *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
            </Field>
            <Field label="연락처">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="담당 코치">
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              >
                <option value="">미지정</option>
                {activeCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {data.member.coach_id &&
                  !activeCoaches.some((c) => c.id === data.member.coach_id) && (
                    <option value={data.member.coach_id}>
                      {coaches.find((c) => c.id === data.member.coach_id)?.name ?? "알 수 없음"}
                      (퇴사)
                    </option>
                  )}
              </select>
            </Field>
            <Field label="상태">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MemberStatus)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </Field>
          </div>
          <Field label="소개해주신 분">
            <input
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="선택 입력"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
          <Field label="운동 목적 / 특이사항">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">결제·패키지 이력</p>
          <div className="rounded-xl border border-line/60 divide-y divide-line/40 overflow-hidden mb-2">
            {data.packages.map((pkg) => (
              <div key={pkg.id} className="px-3 py-2 text-xs">
                {editingPkgId === pkg.id ? (
                  <div className="space-y-1.5">
                    <PtTypeToggle value={editPtType} onChange={setEditPtType} />
                    <PaymentMethodToggle value={editPaymentMethod} onChange={setEditPaymentMethod} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        value={editTotal}
                        onChange={(e) => setEditTotal(e.target.value)}
                        placeholder="횟수"
                        className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                      />
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="금액"
                        className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                      />
                    </div>
                    <input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="메모"
                      className="w-full rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => saveEditPkg(pkg.id)}
                        className="flex-1 rounded-full bg-ink text-white py-1.5 text-xs font-medium hover:bg-coral transition"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingPkgId(null)}
                        className="flex-1 rounded-full border border-line py-1.5 text-xs hover:bg-bone transition"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5">
                        <span className="text-ink/40 whitespace-nowrap">
                          {new Date(pkg.purchased_at).toLocaleDateString("ko-KR")}
                        </span>
                        <TypeBadge isFirst={pkg.id === firstPackageId} />
                        <PtTypeBadge ptType={pkg.pt_type} />
                        <PaymentMethodBadge method={pkg.payment_method} />
                      </p>
                      <p className="text-ink/60 truncate">
                        {pkg.total_sessions}회 · {formatWon(pkg.price)}
                        {pkg.note && ` · ${pkg.note}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEditPkg(pkg)}
                        className="rounded-full border border-line px-2 py-1 hover:bg-bone transition"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deletePkg(pkg.id)}
                        className="rounded-full border border-line px-2 py-1 text-red-500 hover:bg-red-50 transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data.packages.length === 0 && (
              <p className="px-3 py-3 text-xs text-ink/40">결제 이력이 없어요.</p>
            )}
          </div>
          <PtTypeToggle value={addPtType} onChange={setAddPtType} />
          <div className="mt-1.5">
            <PaymentMethodToggle value={addPaymentMethod} onChange={setAddPaymentMethod} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="number"
              value={addSessions}
              onChange={(e) => setAddSessions(e.target.value)}
              placeholder="횟수"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <input
              type="number"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="결제금액"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </div>
          <div className="mt-2">
            <Field label="옵션">
              <input
                value={addOptionNote}
                onChange={(e) => setAddOptionNote(e.target.value)}
                placeholder="할인 내용"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
            </Field>
          </div>
          <button
            onClick={handleAddPackage}
            className="mt-2 w-full rounded-full border border-coral text-coral py-2 text-sm font-medium hover:bg-coral/5 transition"
          >
            + 재등록/패키지 추가
          </button>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">최근 세션 기록</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {data.sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex justify-between text-xs text-ink/60">
                <span>
                  {s.session_date} {s.session_hour}:00
                </span>
                <span>
                  {s.status}
                  {Number(s.total_sessions) > 0 ? ` · ${s.ordinal}/${s.total_sessions}` : ""}
                </span>
              </div>
            ))}
            {data.sessions.length === 0 && (
              <p className="text-xs text-ink/40">아직 세션 기록이 없어요.</p>
            )}
          </div>
        </div>

        <Field label="가능한 요일·시간">
          <input
            value={availableTimes}
            onChange={(e) => setAvailableTimes(e.target.value)}
            placeholder="예: 화·목 오전 10시"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral mb-2"
          />
          <AvailabilityGridPicker onChange={setAvailableTimes} lockable />
        </Field>

        <div>
          <p className="text-sm font-medium mb-2">고정 시간대</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {fixedSlots.length === 0 && (
              <p className="text-xs text-ink/40">등록된 고정 시간대가 없어요.</p>
            )}
            {fixedSlots.map((slot) => (
              <span
                key={slot.id}
                className="flex items-center gap-1 rounded-full bg-bone/70 px-2.5 py-1 text-xs"
              >
                {FIXED_SLOT_WEEKDAY_LABELS[slot.weekday] ?? "?"} {slot.hour}시
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="text-ink/40 hover:text-coral"
                  aria-label="삭제"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={newSlotWeekday}
              onChange={(e) => setNewSlotWeekday(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {FIXED_SLOT_WEEKDAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={newSlotHour}
              onChange={(e) => setNewSlotHour(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {SCHEDULE_HOUR_ROWS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}시
                </option>
              ))}
            </select>
            <button
              onClick={addSlot}
              disabled={savingSlot}
              className="flex-1 rounded-lg border border-coral text-coral text-sm font-medium hover:bg-coral/5 transition disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {slotError && <p className="text-xs text-coral mt-1">{slotError}</p>}
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleRefundClick}
            disabled={saving || !latestPackage}
            className="rounded-full border border-gold px-4 py-2 text-sm text-gold-deep hover:bg-gold/10 transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            환불
          </button>
          <button
            onClick={handleDeleteMember}
            disabled={saving}
            className="rounded-full border border-line px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            삭제
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-line py-2 text-sm hover:bg-bone transition"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full bg-ink text-white py-2 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </ModalShell>
    {showWriteContract && latestPackage && (
      <WriteContractModal
        memberId={memberId}
        latestPackage={latestPackage}
        onClose={() => setShowWriteContract(false)}
        onCreated={() => {
          setShowWriteContract(false);
          onChanged();
          setShowContractView(true);
        }}
      />
    )}
    {showContractView && (
      <ContractViewModal
        memberId={memberId}
        onClose={() => setShowContractView(false)}
        onSigned={() =>
          setData((prev) =>
            prev.contract
              ? { ...prev, contract: { ...prev.contract, signedAt: new Date().toISOString() } }
              : prev,
          )
        }
      />
    )}
    {confirmState && (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50 px-4"
        onClick={() => setConfirmState(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm mb-5 whitespace-pre-line">{confirmState.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmState(null)}
              className="flex-1 rounded-full border border-line py-2 text-sm hover:bg-bone transition"
            >
              취소
            </button>
            <button
              onClick={confirmState.onConfirm}
              className="flex-1 rounded-full bg-coral text-white py-2 text-sm font-medium hover:opacity-90 transition"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    )}
    {refundState && latestPackage && (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50 px-4"
        onClick={() => setRefundState(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-display text-lg mb-3">환불 금액</p>
          <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink/60">결제금액</span>
              <span>{formatWon(latestPackage.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">
                레슨비 차감 (사용 {Math.round(refundState.usedRatio * 100)}%)
              </span>
              <span>−{formatWon(refundState.lessonFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">위약금 (10%)</span>
              <span>−{formatWon(refundState.penalty)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">수수료 (5%)</span>
              <span>−{formatWon(refundState.fee)}</span>
            </div>
            <div className="flex justify-between font-medium pt-1.5 border-t border-line/60">
              <span>최종 환불액</span>
              <span className="text-gold-deep">{formatWon(refundState.refundAmount)}</span>
            </div>
          </div>
          <p className="text-xs text-ink/40 mt-3 whitespace-pre-line">
            완료를 누르면 회원 정보가 삭제돼요(되돌릴 수 없어요). PT 예약 내역과 결제 내역은
            정산 기록으로 남지만, 결제 내역은 환불액을 뺀 금액으로 다시 계산돼요.
          </p>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => setRefundState(null)}
              className="flex-1 rounded-full border border-line py-2 text-sm hover:bg-bone transition"
            >
              취소
            </button>
            <button
              onClick={doRefundAndDelete}
              disabled={saving}
              className="flex-1 rounded-full bg-gold text-white py-2 text-sm font-medium hover:bg-gold-deep transition disabled:opacity-50"
            >
              완료
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 my-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{title}</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
