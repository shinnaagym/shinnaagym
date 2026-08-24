"use client";

import { useMemo, useState } from "react";
import type {
  AdminDeviceRow,
  CoachRow,
  EmploymentType,
  HolidayRow,
  RecurringEventCycle,
  RecurringEventRow,
  SettingsMemoRow,
} from "@/lib/db";
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_OPTIONS,
  SHORTENED_LEAVE_DIRECTION_LABELS,
  SHORTENED_LEAVE_DIRECTION_OPTIONS,
  SHORTENED_LEAVE_HOUR_OPTIONS,
  type LeaveTypeValue,
  type ShortenedLeaveDirection,
} from "@/lib/constants";
import { SyncDiagnostics } from "./sync-diagnostics";
import { MemoPad } from "../memo-pad";

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0~24시(종료 시각용 24 포함)

// lib/recurring-events.ts는 서버 전용 DB 클라이언트(pg)를 물고 있어 클라이언트
// 컴포넌트에서 import하면 번들이 깨지므로, 라벨만 이 파일에 그대로 복제해 둔다.
const CYCLE_LABELS: Record<RecurringEventCycle, string> = {
  monthly: "매달",
  quarterly: "분기(3·6·9·12월)",
};

const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: "정직원",
  freelancer: "프리랜서",
  team_lead: "팀장",
  owner: "대표",
};

// lib/schedule.ts는 서버 전용 DB 클라이언트(pg)를 물고 있어 클라이언트 컴포넌트에서
// import하면 번들이 깨지므로, 타입만 이 파일에 그대로 복제해 둔다.
// weekdayStarts/weekdayEnds는 5개 배열(0=월 ~ 4=금)이지만, 이 화면에서는 오전조/오후조
// 프리셋으로만 저장해 다섯 값이 항상 같다. 토요일 값(saturdayStart/End)은 더 이상 이
// 화면에서 편집하지 않는다 — 토요일 근무는 아래 당직 캘린더에서 9~15시 고정으로 배정된다.
export interface CoachWorkingHours {
  weekdayStarts: number[];
  weekdayEnds: number[];
  saturdayStart: number;
  saturdayEnd: number;
}

/** 코치별 근무시간 설정은 이제 요일별 커스텀 대신 오전조/오후조 중 하나를 고르는
    방식이다. 토요일 값은 더 이상 이 화면에서 쓰이지 않지만(당직 캘린더가 대신함)
    스키마상 NOT NULL이라 9~15시로 채워 둔다. */
const SHIFT_PRESETS = {
  morning: {
    label: "오전조 (9~17시)",
    hours: { weekdayStarts: [9, 9, 9, 9, 9], weekdayEnds: [17, 17, 17, 17, 17], saturdayStart: 9, saturdayEnd: 15 },
  },
  afternoon: {
    label: "오후조 (14~22시)",
    hours: { weekdayStarts: [14, 14, 14, 14, 14], weekdayEnds: [22, 22, 22, 22, 22], saturdayStart: 9, saturdayEnd: 15 },
  },
} as const satisfies Record<string, { label: string; hours: CoachWorkingHours }>;

type ShiftKey = keyof typeof SHIFT_PRESETS;

function detectShift(hours: CoachWorkingHours | undefined): ShiftKey | null {
  if (!hours) return null;
  for (const key of Object.keys(SHIFT_PRESETS) as ShiftKey[]) {
    const preset = SHIFT_PRESETS[key].hours;
    if (
      hours.weekdayStarts.join(",") === preset.weekdayStarts.join(",") &&
      hours.weekdayEnds.join(",") === preset.weekdayEnds.join(",")
    ) {
      return key;
    }
  }
  return null;
}

/** 코치 한 명의 근무 조(오전/오후)를 고르는 행. 클릭하는 즉시 저장된다. */
function CoachShiftRow({
  coachName,
  saved,
  onSelect,
  onClear,
}: {
  coachName: string;
  saved: CoachWorkingHours | undefined;
  onSelect: (hours: CoachWorkingHours) => void;
  onClear: () => void;
}) {
  const current = detectShift(saved);
  return (
    <div className="py-2.5 flex items-center gap-3 flex-wrap">
      <span className="text-sm w-16 shrink-0">{coachName}</span>
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(SHIFT_PRESETS) as ShiftKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(SHIFT_PRESETS[key].hours)}
            className={[
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              current === key
                ? "bg-ink text-white border-ink"
                : "border-line text-ink/60 hover:bg-bone",
            ].join(" ")}
          >
            {SHIFT_PRESETS[key].label}
          </button>
        ))}
      </div>
      {saved && (
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-ink/40 hover:text-coral"
        >
          제한 없음으로 초기화
        </button>
      )}
    </div>
  );
}

// ---- 토요일 당직 캘린더 ----

const CALENDAR_WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** "YYYY-MM-DD"의 요일(0=월~6=일)을 반환한다. */
function calendarWeekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function daysInCalendarMonth(monthKey: string): string[] {
  const [y, m] = monthKey.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

type DutyOverrideMap = Record<string, { coachId: number | null; coachName: string | null }>;
type BlockedDayMap = Record<string, { coachId: number; coachName: string; memo: string }[]>;
type CoachLeaveMap = Record<
  string,
  { id: number; coachId: number; coachName: string; leaveType: string; direction: string | null; hours: number | null }[]
>;
type PromoPostMap = Record<string, { id: number; coachId: number; coachName: string }[]>;

/** 휴가 표시 문구를 만든다. 단축근무는 "단축근무(출근 지연 2시간)"처럼 방향·시간을 덧붙인다. */
function formatLeaveLabel(entry: { leaveType: string; direction: string | null; hours: number | null }): string {
  const base = LEAVE_TYPE_LABELS[entry.leaveType] ?? entry.leaveType;
  if (entry.leaveType === "shortened" && entry.direction && entry.hours) {
    const dirLabel = SHORTENED_LEAVE_DIRECTION_LABELS[entry.direction] ?? entry.direction;
    return `${base}(${dirLabel} ${entry.hours}시간)`;
  }
  return base;
}

/** 코치 한 명의 휴가·포스팅 기록을 날짜 하나에 대해 추가/삭제하는 모달.
    "+기록" 버튼을 눌러 연다. */
function DayDetailModal({
  date,
  coaches,
  leaves,
  posts,
  onClose,
  onAddLeave,
  onRemoveLeave,
  onAddPost,
  onRemovePost,
}: {
  date: string;
  coaches: CoachRow[];
  leaves: CoachLeaveMap[string];
  posts: PromoPostMap[string];
  onClose: () => void;
  onAddLeave: (
    coachId: number,
    leaveType: LeaveTypeValue,
    direction: ShortenedLeaveDirection | null,
    hours: number | null,
  ) => void;
  onRemoveLeave: (id: number) => void;
  onAddPost: (coachId: number) => void;
  onRemovePost: (id: number) => void;
}) {
  const [leaveCoachId, setLeaveCoachId] = useState(coaches[0]?.id ?? 0);
  const [leaveType, setLeaveType] = useState<LeaveTypeValue>(LEAVE_TYPE_OPTIONS[0].value);
  const [shortenedDirection, setShortenedDirection] = useState<ShortenedLeaveDirection>(
    SHORTENED_LEAVE_DIRECTION_OPTIONS[0].value,
  );
  const [shortenedHours, setShortenedHours] = useState(SHORTENED_LEAVE_HOUR_OPTIONS[0]);
  const [postCoachId, setPostCoachId] = useState(coaches[0]?.id ?? 0);
  const [, m, d] = date.split("-").map(Number);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base">
            {m}월 {d}일
          </h3>
          <button type="button" onClick={onClose} className="text-sm text-ink/40 hover:text-ink">
            닫기
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-ink/60">휴가</p>
          <div className="mb-2 space-y-1.5">
            {leaves.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
              >
                <span>
                  {l.coachName} · {formatLeaveLabel(l)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveLeave(l.id)}
                  className="text-red-400 hover:underline"
                >
                  삭제
                </button>
              </div>
            ))}
            {leaves.length === 0 && <p className="text-xs text-ink/30">등록된 휴가가 없어요.</p>}
          </div>
          {coaches.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <select
                  value={leaveCoachId}
                  onChange={(e) => setLeaveCoachId(Number(e.target.value))}
                  className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveTypeValue)}
                  className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {LEAVE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {leaveType === "shortened" && (
                <div className="flex gap-1.5">
                  <select
                    value={shortenedDirection}
                    onChange={(e) => setShortenedDirection(e.target.value as ShortenedLeaveDirection)}
                    className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                  >
                    {SHORTENED_LEAVE_DIRECTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={shortenedHours}
                    onChange={(e) => setShortenedHours(Number(e.target.value))}
                    className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                  >
                    {SHORTENED_LEAVE_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}시간
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  onAddLeave(
                    leaveCoachId,
                    leaveType,
                    leaveType === "shortened" ? shortenedDirection : null,
                    leaveType === "shortened" ? shortenedHours : null,
                  )
                }
                className="w-full rounded-lg bg-ink px-3 py-1.5 text-xs text-white transition hover:bg-coral"
              >
                휴가 추가
              </button>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink/60">홍보 포스팅</p>
          <div className="mb-2 space-y-1.5">
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs text-sky-900"
              >
                <span>{p.coachName} · 포스팅 완료</span>
                <button
                  type="button"
                  onClick={() => onRemovePost(p.id)}
                  className="text-red-400 hover:underline"
                >
                  삭제
                </button>
              </div>
            ))}
            {posts.length === 0 && <p className="text-xs text-ink/30">등록된 포스팅이 없어요.</p>}
          </div>
          {coaches.length > 0 && (
            <div className="flex gap-1.5">
              <select
                value={postCoachId}
                onChange={(e) => setPostCoachId(Number(e.target.value))}
                className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onAddPost(postCoachId)}
                className="shrink-0 rounded-lg bg-ink px-3 text-xs text-white transition hover:bg-coral"
              >
                추가
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 토요일마다 당직 코치를 배정하고, 코치별 휴가·홍보 포스팅 기록을 함께 관리하는
    월별 캘린더. 코치별 당직은 월 1회로 제한되며(서버에서 검증), 스케줄표의
    "수업 불가" 표시(휴가)도 함께 보여줘 당직 배정할 때 참고할 수 있게 한다. */
function DutyCalendar({
  coaches,
  initialMonth,
  initialOverrides,
  initialBlockedDays,
  initialCoachLeaves,
  initialPromoPosts,
}: {
  coaches: CoachRow[];
  initialMonth: string;
  initialOverrides: DutyOverrideMap;
  initialBlockedDays: BlockedDayMap;
  initialCoachLeaves: CoachLeaveMap;
  initialPromoPosts: PromoPostMap;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [overrides, setOverrides] = useState<DutyOverrideMap>(initialOverrides);
  const [blockedDays, setBlockedDays] = useState<BlockedDayMap>(initialBlockedDays);
  const [leaves, setLeaves] = useState<CoachLeaveMap>(initialCoachLeaves);
  const [posts, setPosts] = useState<PromoPostMap>(initialPromoPosts);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function goToMonth(nextMonth: string) {
    setMonth(nextMonth);
    setLoading(true);
    setCalendarError(null);
    try {
      const res = await fetch(`/api/admin/duty-calendar?month=${nextMonth}`);
      const data = await res.json();
      if (res.ok) {
        setOverrides(data.overrides);
        setBlockedDays(data.blocked);
        setLeaves(data.leaves);
        setPosts(data.posts);
      }
    } finally {
      setLoading(false);
    }
  }

  async function assignSaturday(date: string, coachId: number | null | undefined) {
    const prevOverrides = overrides;
    const coach = typeof coachId === "number" ? coaches.find((c) => c.id === coachId) : null;
    setOverrides((prev) => {
      const next = { ...prev };
      if (coachId === undefined) delete next[date];
      else next[date] = { coachId, coachName: coach?.name ?? null };
      return next;
    });
    setCalendarError(null);
    const res = await fetch("/api/admin/duty-override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coachId === undefined ? { date, clear: true } : { date, coachId }),
    });
    if (!res.ok) {
      setOverrides(prevOverrides);
      const data = await res.json().catch(() => ({}));
      setCalendarError(data.error ?? "당직 지정에 실패했습니다.");
    }
  }

  async function addLeave(
    date: string,
    coachId: number,
    leaveType: LeaveTypeValue,
    direction: ShortenedLeaveDirection | null,
    hours: number | null,
  ) {
    const res = await fetch("/api/admin/coach-leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId, date, leaveType, direction, hours }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setLeaves((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), data.entry] }));
    } else {
      setCalendarError(data.error ?? "휴가 등록에 실패했습니다.");
    }
  }

  async function removeLeave(date: string, id: number) {
    setLeaves((prev) => ({ ...prev, [date]: (prev[date] ?? []).filter((l) => l.id !== id) }));
    await fetch(`/api/admin/coach-leaves?id=${id}`, { method: "DELETE" });
  }

  async function addPost(date: string, coachId: number) {
    const res = await fetch("/api/admin/promo-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId, date }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPosts((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), data.entry] }));
    } else {
      setCalendarError(data.error ?? "포스팅 등록에 실패했습니다.");
    }
  }

  async function removePost(date: string, id: number) {
    setPosts((prev) => ({ ...prev, [date]: (prev[date] ?? []).filter((p) => p.id !== id) }));
    await fetch(`/api/admin/promo-posts?id=${id}`, { method: "DELETE" });
  }

  const days = daysInCalendarMonth(month);
  const leadingBlanks = calendarWeekdayOf(days[0]);
  const [year, monthNum] = month.split("-").map(Number);

  // 코치 x 휴가 유형별 사용 일수, 코치별 포스팅 횟수(현재 보고 있는 달 기준).
  const leaveStats = useMemo(() => {
    const counts: Record<number, Record<string, number>> = {};
    for (const entries of Object.values(leaves)) {
      for (const l of entries) {
        const coachCounts = (counts[l.coachId] ??= {});
        coachCounts[l.leaveType] = (coachCounts[l.leaveType] ?? 0) + 1;
      }
    }
    return counts;
  }, [leaves]);

  const postStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const entries of Object.values(posts)) {
      for (const p of entries) {
        counts[p.coachId] = (counts[p.coachId] ?? 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => goToMonth(shiftMonthKey(month, -1))}
          className="rounded-full border border-line w-8 h-8 text-sm hover:bg-bone transition"
        >
          ‹
        </button>
        <p className="text-sm font-medium">
          {year}년 {monthNum}월{loading && <span className="text-ink/30"> · 불러오는 중</span>}
        </p>
        <button
          type="button"
          onClick={() => goToMonth(shiftMonthKey(month, 1))}
          className="rounded-full border border-line w-8 h-8 text-sm hover:bg-bone transition"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink/40 mb-1">
        {CALENDAR_WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const isSaturday = calendarWeekdayOf(d) === 5;
          const dayNum = Number(d.split("-")[2]);
          const duty = overrides[d];
          const blockedToday = blockedDays[d] ?? [];
          const leavesToday = leaves[d] ?? [];
          const postsToday = posts[d] ?? [];
          return (
            <div
              key={d}
              className={[
                "rounded-lg border p-1.5 min-h-[62px] flex flex-col gap-1",
                isSaturday ? "border-coral/30 bg-coral/[0.03]" : "border-line/50",
              ].join(" ")}
            >
              <span className="text-[11px] text-ink/50">{dayNum}</span>
              {isSaturday && (
                <select
                  value={duty?.coachId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    assignSaturday(d, v === "" ? undefined : Number(v));
                  }}
                  className="w-full min-w-0 rounded border border-line/70 bg-white px-1 py-0.5 text-[10px] outline-none focus:border-coral"
                >
                  <option value="">미배정</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {blockedToday.map((b, i) => (
                <span
                  key={`b${i}`}
                  title={b.memo}
                  className="truncate rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-700"
                >
                  {b.coachName} · {b.memo || "휴가"}
                </span>
              ))}
              {leavesToday.map((l) => (
                <span
                  key={`l${l.id}`}
                  title={formatLeaveLabel(l)}
                  className="truncate rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-800"
                >
                  {l.coachName} · {formatLeaveLabel(l)}
                </span>
              ))}
              {postsToday.map((p) => (
                <span
                  key={`p${p.id}`}
                  className="truncate rounded bg-sky-100 px-1 py-0.5 text-[9px] text-sky-800"
                >
                  {p.coachName} · 포스팅
                </span>
              ))}
              <button
                type="button"
                onClick={() => setSelectedDate(d)}
                className="mt-auto text-left text-[9px] text-ink/30 hover:text-coral"
              >
                + 기록
              </button>
            </div>
          );
        })}
      </div>
      {calendarError && <p className="text-sm text-coral mt-3">{calendarError}</p>}

      <div className="mt-6 border-t border-line/50 pt-4">
        <p className="mb-2 text-xs font-medium text-ink/60">
          {year}년 {monthNum}월 통계
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-ink/40">
                <th className="py-1.5 pr-2 text-left font-medium">코치</th>
                {LEAVE_TYPE_OPTIONS.map((o) => (
                  <th key={o.value} className="px-2 py-1.5 text-center font-medium">
                    {o.label}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-center font-medium">포스팅</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5 pr-2">{c.name}</td>
                  {LEAVE_TYPE_OPTIONS.map((o) => {
                    const count = leaveStats[c.id]?.[o.value] ?? 0;
                    return (
                      <td
                        key={o.value}
                        className={[
                          "px-2 py-1.5 text-center",
                          count > 0 ? "font-medium text-amber-800" : "text-ink/25",
                        ].join(" ")}
                      >
                        {count > 0 ? `${count}일` : "-"}
                      </td>
                    );
                  })}
                  <td
                    className={[
                      "py-1.5 pl-2 text-center",
                      (postStats[c.id] ?? 0) > 0 ? "font-medium text-sky-800" : "text-ink/25",
                    ].join(" ")}
                  >
                    {(postStats[c.id] ?? 0) > 0 ? `${postStats[c.id]}회` : "-"}
                  </td>
                </tr>
              ))}
              {coaches.length === 0 && (
                <tr>
                  <td colSpan={LEAVE_TYPE_OPTIONS.length + 2} className="py-2 text-center text-ink/30">
                    재직 중인 코치가 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          coaches={coaches}
          leaves={leaves[selectedDate] ?? []}
          posts={posts[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
          onAddLeave={(coachId, leaveType, direction, hours) =>
            addLeave(selectedDate, coachId, leaveType, direction, hours)
          }
          onRemoveLeave={(id) => removeLeave(selectedDate, id)}
          onAddPost={(coachId) => addPost(selectedDate, coachId)}
          onRemovePost={(id) => removePost(selectedDate, id)}
        />
      )}
    </div>
  );
}

export function SettingsView({
  initialCoaches,
  initialHolidays,
  memberCounts,
  buildId,
  initialDevices,
  currentDeviceId,
  initialDutyMonth,
  initialDutyOverrides,
  initialBlockedDays,
  initialCoachLeaves,
  initialPromoPosts,
  initialRecurringEvents,
  initialSettingsMemos,
  initialCoachWorkingHours,
}: {
  initialCoaches: CoachRow[];
  initialHolidays: HolidayRow[];
  memberCounts: Record<number, number>;
  buildId: string;
  initialDevices: AdminDeviceRow[];
  currentDeviceId: string | null;
  initialDutyMonth: string;
  initialDutyOverrides: DutyOverrideMap;
  initialBlockedDays: BlockedDayMap;
  initialCoachLeaves: CoachLeaveMap;
  initialPromoPosts: PromoPostMap;
  initialRecurringEvents: RecurringEventRow[];
  initialSettingsMemos: SettingsMemoRow[];
  initialCoachWorkingHours: Record<number, CoachWorkingHours>;
}) {
  const [coaches, setCoaches] = useState(initialCoaches);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [coachWorkingHours, setCoachWorkingHours] = useState(initialCoachWorkingHours);
  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachPhone, setNewCoachPhone] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [recurringEvents, setRecurringEvents] = useState(initialRecurringEvents);
  const [newEventName, setNewEventName] = useState("");
  const [newEventCycle, setNewEventCycle] = useState<RecurringEventCycle>("monthly");
  const [newEventDay, setNewEventDay] = useState(1);
  const [newEventStartHour, setNewEventStartHour] = useState(12);
  const [newEventEndHour, setNewEventEndHour] = useState(14);
  const [error, setError] = useState<string | null>(null);

  async function saveCoachWorkingHours(coachId: number, hours: CoachWorkingHours) {
    const invalidWeekday = hours.weekdayStarts.some((h, i) => h >= hours.weekdayEnds[i]);
    if (invalidWeekday || hours.saturdayStart >= hours.saturdayEnd) {
      setError("종료 시각은 시작 시각보다 늦어야 해요.");
      return;
    }
    setError(null);
    setCoachWorkingHours((prev) => ({ ...prev, [coachId]: hours }));
    await fetch("/api/admin/coach-working-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId, ...hours }),
    });
  }

  async function clearCoachWorkingHours(coachId: number) {
    setCoachWorkingHours((prev) => {
      const next = { ...prev };
      delete next[coachId];
      return next;
    });
    await fetch("/api/admin/coach-working-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId, clear: true }),
    });
  }

  async function addCoach() {
    if (!newCoachName.trim()) return;
    setError(null);
    const res = await fetch("/api/admin/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCoachName.trim(), phone: newCoachPhone.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "코치 등록에 실패했습니다.");
      return;
    }
    setCoaches((prev) => [...prev, data.coach]);
    setNewCoachName("");
    setNewCoachPhone("");
  }

  async function updateCoachPhone(id: number, phone: string) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, phone } : c)));
    await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
  }

  async function updateCoachBirthday(id: number, birthday: string) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, birthday } : c)));
    await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday }),
    });
  }

  async function updateCoachEmployment(
    id: number,
    patch: Partial<Pick<CoachRow, "employment_type" | "hired_at" | "is_team_lead">>,
  ) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employmentType: patch.employment_type,
        hiredAt: patch.hired_at,
        isTeamLead: patch.is_team_lead,
      }),
    });
  }

  async function toggleCoach(coach: CoachRow) {
    if (coach.active) {
      const activeMembers = memberCounts[coach.id] ?? 0;
      const confirmMessage =
        activeMembers > 0
          ? `${coach.name} 코치에게 배정된 활성 회원이 ${activeMembers}명 있어요. 퇴사 처리해도 회원 담당은 자동으로 바뀌지 않으니, 회원 관리에서 먼저 담당 코치를 변경하는 걸 추천해요. 그래도 퇴사 처리할까요?`
          : `${coach.name} 코치를 퇴사 처리할까요? 스케줄표에서 컬럼이 사라지고, 새 회원 등록 시 선택할 수 없게 돼요.`;
      if (!confirm(confirmMessage)) return;
    }
    await fetch(`/api/admin/coaches/${coach.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coach.active }),
    });
    setCoaches((prev) =>
      prev.map((c) => (c.id === coach.id ? { ...c, active: !c.active } : c)),
    );
  }

  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) {
      setError("날짜와 이름을 모두 입력해주세요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newHolidayDate, name: newHolidayName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "공휴일 추가에 실패했습니다.");
      return;
    }
    setHolidays((prev) =>
      [...prev.filter((h) => h.holiday_date !== newHolidayDate), { holiday_date: newHolidayDate, name: newHolidayName.trim() }].sort(
        (a, b) => a.holiday_date.localeCompare(b.holiday_date),
      ),
    );
    setNewHolidayDate("");
    setNewHolidayName("");
  }

  async function removeHoliday(date: string) {
    await fetch(`/api/admin/holidays?date=${date}`, { method: "DELETE" });
    setHolidays((prev) => prev.filter((h) => h.holiday_date !== date));
  }

  async function addRecurringEvent() {
    if (!newEventName.trim()) {
      setError("정기 일정 이름을 입력해주세요.");
      return;
    }
    if (newEventStartHour >= newEventEndHour) {
      setError("종료 시각은 시작 시각보다 늦어야 해요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/recurring-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newEventName.trim(),
        cycle: newEventCycle,
        dayOfMonth: newEventDay,
        startHour: newEventStartHour,
        endHour: newEventEndHour,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "정기 일정 등록에 실패했습니다.");
      return;
    }
    setRecurringEvents((prev) => [...prev, data.event]);
    setNewEventName("");
    setNewEventCycle("monthly");
    setNewEventDay(1);
    setNewEventStartHour(12);
    setNewEventEndHour(14);
  }

  async function patchRecurringEvent(
    id: number,
    patch: Partial<{
      name: string;
      cycle: RecurringEventCycle;
      dayOfMonth: number;
      startHour: number;
      endHour: number;
      enabled: boolean;
    }>,
  ) {
    setRecurringEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(patch.name !== undefined && { name: patch.name }),
              ...(patch.cycle !== undefined && { cycle: patch.cycle }),
              ...(patch.dayOfMonth !== undefined && { day_of_month: patch.dayOfMonth }),
              ...(patch.startHour !== undefined && { start_hour: patch.startHour }),
              ...(patch.endHour !== undefined && { end_hour: patch.endHour }),
              ...(patch.enabled !== undefined && { enabled: patch.enabled }),
            }
          : e,
      ),
    );
    await fetch(`/api/admin/recurring-events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeRecurringEvent(id: number) {
    setRecurringEvents((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/admin/recurring-events/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <MemoPad
        title="메모장"
        initialMemos={initialSettingsMemos}
        addUrl="/api/admin/settings-memos"
        itemUrlBase="/api/admin/settings-memos"
      />

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">코치 관리</h2>
        <p className="text-xs text-ink/50 mb-4">
          지금은 신종수 코치 1명이지만, 나중에 코치가 추가되면 여기서 등록해주세요. 등록하는
          즉시 스케줄표에 컬럼이 생깁니다.
        </p>
        <div className="divide-y divide-line/50">
          {coaches.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{c.name}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px]",
                      c.active ? "bg-sage/10 text-sage" : "bg-line/40 text-ink/40",
                    ].join(" ")}
                  >
                    {c.active ? "재직 중" : "퇴사함"}
                  </span>
                  {c.active && (memberCounts[c.id] ?? 0) > 0 && (
                    <span className="text-[11px] text-ink/40">
                      담당 {memberCounts[c.id]}명
                    </span>
                  )}
                  <input
                    defaultValue={c.phone}
                    placeholder="010-0000-0000"
                    onBlur={(e) => updateCoachPhone(c.id, e.target.value.trim())}
                    className="w-40 rounded-lg border border-line px-2.5 py-1 text-xs outline-none focus:border-coral"
                  />
                  <span className="flex items-center gap-1 text-[11px] text-ink/40">
                    생일
                    <input
                      type="date"
                      defaultValue={c.birthday}
                      onChange={(e) => updateCoachBirthday(c.id, e.target.value)}
                      className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                    />
                  </span>
                </div>
                <button
                  onClick={() => toggleCoach(c)}
                  className={[
                    "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs border transition",
                    c.active
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-sage/50 text-sage hover:bg-sage/10",
                  ].join(" ")}
                >
                  {c.active ? "퇴사 처리" : "재직으로 전환"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-0.5">
                <span className="text-[11px] text-ink/40">급여 계산용</span>
                <select
                  value={c.employment_type}
                  onChange={(e) =>
                    updateCoachEmployment(c.id, {
                      employment_type: e.target.value as EmploymentType,
                    })
                  }
                  className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                >
                  {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((type) => (
                    <option key={type} value={type}>
                      {EMPLOYMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
                <span className="flex items-center gap-1 text-[11px] text-ink/40">
                  입사일
                  <input
                    type="date"
                    defaultValue={c.hired_at}
                    onChange={(e) => updateCoachEmployment(c.id, { hired_at: e.target.value })}
                    className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                  />
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            value={newCoachName}
            onChange={(e) => setNewCoachName(e.target.value)}
            placeholder="새 코치 이름"
            className="flex-1 min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <input
            value={newCoachPhone}
            onChange={(e) => setNewCoachPhone(e.target.value)}
            placeholder="연락처 (예: 010-0000-0000)"
            className="flex-1 min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <button
            onClick={addCoach}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">근무시간 설정</h2>
        <p className="text-xs text-ink/50 mb-4">
          코치별로 오전조(9~17시) 또는 오후조(14~22시) 중 하나를 지정하면, 스케줄표에서
          그 시간 외 칸이 회색으로 표시돼요(예약 자체가 막히진 않아요). 지정하지 않은
          코치는 스튜디오 영업시간 전체가 근무시간으로 취급돼 회색 표시가 나타나지
          않아요. 토요일 근무는 아래 당직 캘린더에서 별도로 배정합니다.
        </p>
        <div className="divide-y divide-line/50">
          {coaches
            .filter((c) => c.active)
            .map((c) => (
              <CoachShiftRow
                key={c.id}
                coachName={c.name}
                saved={coachWorkingHours[c.id]}
                onSelect={(hours) => saveCoachWorkingHours(c.id, hours)}
                onClear={() => clearCoachWorkingHours(c.id)}
              />
            ))}
          {coaches.filter((c) => c.active).length === 0 && (
            <p className="text-sm text-ink/40 py-2.5">재직 중인 코치가 없어요.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">당직 · 휴가 · 홍보 포스팅 캘린더</h2>
        <p className="text-xs text-ink/50 mb-4">
          토요일마다 당직 코치 한 명을 배정하세요(9~15시 고정 근무, 같은 코치를 한
          달에 두 번 이상 배정할 수는 없어요). 날짜 칸의 &quot;+ 기록&quot;을 누르면
          코치별 휴가(단축근무 · 휴무 · 연속 휴가 · 병가 · 생일휴가)와 정직원의
          블로그·인스타그램 홍보 포스팅(2주 1회) 기록을 남길 수 있어요 — 당직 배정
          시 참고하세요.
        </p>
        <DutyCalendar
          coaches={coaches.filter((c) => c.active)}
          initialMonth={initialDutyMonth}
          initialOverrides={initialDutyOverrides}
          initialBlockedDays={initialBlockedDays}
          initialCoachLeaves={initialCoachLeaves}
          initialPromoPosts={initialPromoPosts}
        />
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">공휴일 관리</h2>
        <p className="text-xs text-ink/50 mb-4">
          토요일과 동일하게 9~15시로 단축 운영되는 날입니다. 2026년 공휴일이 기본으로
          들어있지만, 설날·부처님오신날·추석처럼 음력 기반 날짜는 추정치이니 정확한 날짜로
          확인 후 조정해주세요.
        </p>
        <div className="divide-y divide-line/50 max-h-64 overflow-y-auto">
          {holidays.map((h) => (
            <div key={h.holiday_date} className="flex items-center justify-between py-2 text-sm">
              <span>
                {h.holiday_date} · {h.name}
              </span>
              <button
                onClick={() => removeHoliday(h.holiday_date)}
                className="text-xs text-red-400 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="w-full sm:w-auto min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <input
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            placeholder="이름 (예: 대체공휴일)"
            className="flex-1 min-w-0 sm:min-w-[140px] rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <button
            onClick={addHoliday}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
        {error && <p className="text-sm text-coral mt-3">{error}</p>}
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">정기 일정</h2>
        <p className="text-xs text-ink/50 mb-4">
          매달 또는 분기(3·6·9·12월)마다 같은 날짜·시간에 반복되는 일정이에요. 등록하면
          재직 중인 코치 전원의 스케줄표에 자동으로 잡혀 그 시간엔 다른 예약을 받을 수
          없어요. 날짜가 토·일요일이거나 공휴일 관리에 등록된 날이면 자동으로 그다음
          평일로 미뤄져요(대체공휴일도 공휴일 관리에 등록해두면 함께 반영돼요).
        </p>
        <div className="divide-y divide-line/50">
          {recurringEvents.map((ev) => (
            <div key={ev.id} className="py-2.5 flex items-center gap-2 flex-wrap">
              <input
                defaultValue={ev.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== ev.name) patchRecurringEvent(ev.id, { name });
                }}
                className="w-28 min-w-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
              />
              <select
                value={ev.cycle}
                onChange={(e) =>
                  patchRecurringEvent(ev.id, { cycle: e.target.value as RecurringEventCycle })
                }
                className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
              >
                {(Object.keys(CYCLE_LABELS) as RecurringEventCycle[]).map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {CYCLE_LABELS[cycle]}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1 text-xs text-ink/60">
                매
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={ev.day_of_month}
                  onChange={(e) => {
                    const day = Number(e.target.value);
                    if (Number.isInteger(day) && day >= 1 && day <= 28) {
                      patchRecurringEvent(ev.id, { dayOfMonth: day });
                    }
                  }}
                  className="w-12 rounded-lg border border-line px-1.5 py-1.5 text-xs text-center outline-none focus:border-coral"
                />
                일
              </span>
              <span className="flex items-center gap-1 text-xs text-ink/60">
                <select
                  value={ev.start_hour}
                  onChange={(e) =>
                    patchRecurringEvent(ev.id, { startHour: Number(e.target.value) })
                  }
                  className="rounded-lg border border-line px-1.5 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {HOUR_OPTIONS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                ~
                <select
                  value={ev.end_hour}
                  onChange={(e) => patchRecurringEvent(ev.id, { endHour: Number(e.target.value) })}
                  className="rounded-lg border border-line px-1.5 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {HOUR_OPTIONS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
              </span>
              <label className="flex items-center gap-1 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={ev.enabled}
                  onChange={(e) => patchRecurringEvent(ev.id, { enabled: e.target.checked })}
                />
                사용
              </label>
              <button
                onClick={() => removeRecurringEvent(ev.id)}
                className="ml-auto shrink-0 text-xs text-red-400 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
          {recurringEvents.length === 0 && (
            <p className="text-sm text-ink/40 py-2.5">등록된 정기 일정이 없어요.</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
          <input
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="이름 (예: 스터디)"
            className="flex-1 min-w-0 sm:w-28 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <select
            value={newEventCycle}
            onChange={(e) => setNewEventCycle(e.target.value as RecurringEventCycle)}
            className="rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-coral"
          >
            {(Object.keys(CYCLE_LABELS) as RecurringEventCycle[]).map((cycle) => (
              <option key={cycle} value={cycle}>
                {CYCLE_LABELS[cycle]}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1 text-sm text-ink/60">
            매
            <input
              type="number"
              min={1}
              max={28}
              value={newEventDay}
              onChange={(e) => setNewEventDay(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-2 text-sm text-center outline-none focus:border-coral"
            />
            일
          </span>
          <span className="flex items-center gap-1 text-sm text-ink/60">
            <select
              value={newEventStartHour}
              onChange={(e) => setNewEventStartHour(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-coral"
            >
              {HOUR_OPTIONS.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
            ~
            <select
              value={newEventEndHour}
              onChange={(e) => setNewEventEndHour(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-coral"
            >
              {HOUR_OPTIONS.slice(1).map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
          </span>
          <button
            onClick={addRecurringEvent}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
      </section>

      <SyncDiagnostics
        buildId={buildId}
        initialDevices={initialDevices}
        currentDeviceId={currentDeviceId}
      />
    </div>
  );
}
