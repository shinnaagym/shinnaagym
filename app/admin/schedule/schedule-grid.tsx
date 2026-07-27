"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import { addDaysToKey, mondayOfWeek } from "@/lib/date";
import type { CoachRow, PtType, SessionEntryType, SessionStatus } from "@/lib/db";
import type { MemberWithProgress } from "@/lib/schedule";
import type { DayHours } from "@/lib/constants";

type SessionWithMember = {
  id: number;
  member_id: number | null;
  coach_id: number;
  session_date: string;
  session_hour: number;
  status: SessionStatus;
  memo: string;
  entry_type: SessionEntryType;
  pt_type: PtType;
  member_name: string | null;
  coach_name: string;
  ordinal: number | null;
  total_sessions: number | null;
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const CATEGORY_LABELS: Record<SessionEntryType, string> = {
  session: "PT 수업",
  consultation: "상담",
  memo: "개인 일정",
  blocked: "수업 불가",
};

const STATUS_STYLE: Record<SessionStatus, string> = {
  reserved: "bg-white border-coral/40 text-ink",
  completed: "bg-sage/20 border-sage/50 text-ink",
  no_show: "bg-red-50 border-red-300 text-red-700 line-through",
  cancelled: "bg-transparent border-dashed border-line text-ink/30 line-through",
};

const MEMO_STYLE = "bg-violet-50 border-violet-200 text-violet-700";
const CONSULT_STYLE = "bg-amber-50 border-amber-300 text-amber-800";
const BLOCKED_STYLE = "bg-ink/5 border-ink/25 text-ink/50";

const STATUS_LABEL: Record<SessionStatus, string> = {
  reserved: "예약",
  completed: "완료",
  no_show: "노쇼",
  cancelled: "취소",
};

/** 코치별로 다른 색을 매기기 위한 팔레트. 코치 순서에 따라 순환한다. */
// 신나아짐 브랜드 톤(골드·세이지·코랄 + 보조 색)에서 파생한 코치 색상 팔레트.
// Tailwind 기본 rainbow 팔레트 대신 브랜드와 어울리는 톤만 순환시킨다.
const COACH_COLOR_PALETTE: Array<{ header: string; headerText: string; accent: string }> = [
  { header: "bg-gold/15", headerText: "text-gold", accent: "border-l-gold" },
  { header: "bg-sage/20", headerText: "text-[#3f6357]", accent: "border-l-sage" },
  { header: "bg-coral/12", headerText: "text-[#a84a2c]", accent: "border-l-coral" },
  { header: "bg-[#e6ecec]", headerText: "text-[#3d5a5c]", accent: "border-l-[#8fadaf]" },
  { header: "bg-[#f1e3e0]", headerText: "text-[#8a5347]", accent: "border-l-[#c98f83]" },
  { header: "bg-[#f3e9d2]", headerText: "text-[#8a6a1f]", accent: "border-l-[#cdae6a]" },
];

/** 일정 pill의 배경/테두리 스타일. 상담·메모·수업불가는 상태와 무관하게 고정 톤을 쓴다(취소 제외). */
function entryStyle(session: SessionWithMember): string {
  if (session.entry_type === "memo") return MEMO_STYLE;
  if (session.entry_type === "blocked") return BLOCKED_STYLE;
  if (session.status === "cancelled") return STATUS_STYLE.cancelled;
  if (session.entry_type === "consultation") return CONSULT_STYLE;
  return STATUS_STYLE[session.status];
}

function entryIcon(session: SessionWithMember): string {
  switch (session.entry_type) {
    case "consultation":
      return "💬 ";
    case "memo":
      return "📝 ";
    case "blocked":
      return "🚫 ";
    case "session":
      return session.pt_type === "2:1" ? "👥 " : "";
    default:
      return "";
  }
}

function isSimpleEntry(session: SessionWithMember): boolean {
  return session.entry_type === "memo" || session.entry_type === "blocked";
}

function entryMainLabel(session: SessionWithMember): string {
  if (isSimpleEntry(session)) return session.memo || (session.entry_type === "blocked" ? "수업 불가" : "메모");
  return session.member_name ?? "";
}

/** 세션 pill에 표시할 "진행/총" 회차 문구. 개인 일정·수업 불가는 대상이 없어 null. */
function progressLabel(session: SessionWithMember): string | null {
  if (isSimpleEntry(session)) return null;
  const total = Number(session.total_sessions);
  if (!total) return null;
  return `${session.ordinal ?? "-"}/${total}`;
}

function formatWeekLabel(dateKeys: string[]) {
  const [, m1, d1] = dateKeys[0].split("-");
  const [, m2, d2] = dateKeys[6].split("-");
  return `${Number(m1)}.${Number(d1)} - ${Number(m2)}.${Number(d2)}`;
}

export function ScheduleGrid({
  weekStart,
  dateKeys,
  today,
  coaches,
  members,
  initialSessions,
  dayHours,
  holidayMap,
}: {
  weekStart: string;
  dateKeys: string[];
  today: string;
  coaches: CoachRow[];
  members: MemberWithProgress[];
  initialSessions: SessionWithMember[];
  dayHours: Record<string, DayHours>;
  holidayMap: Record<string, string>;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [loading, setLoading] = useState(false);
  const [createTarget, setCreateTarget] = useState<{
    date: string;
    hour: number;
    coachId: number;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<SessionWithMember | null>(null);
  const todayIdx = dateKeys.indexOf(today);
  const [selectedDayIdx, setSelectedDayIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const dayChipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [coachFilter, setCoachFilter] = useState<number | "all">("all");

  useEffect(() => {
    dayChipRefs.current[selectedDayIdx]?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
  }, [selectedDayIdx]);

  const effectiveCoaches = coaches.length > 0 ? coaches : [];
  const visibleCoaches =
    coachFilter === "all" ? effectiveCoaches : effectiveCoaches.filter((c) => c.id === coachFilter);

  /** 코치별 색상은 전체 코치 목록 기준 순서로 고정해, 필터링해도 같은 코치는 항상 같은 색을 쓴다. */
  const coachColorMap = useMemo(() => {
    const map = new Map<number, (typeof COACH_COLOR_PALETTE)[number]>();
    coaches.forEach((c, i) => {
      map.set(c.id, COACH_COLOR_PALETTE[i % COACH_COLOR_PALETTE.length]);
    });
    return map;
  }, [coaches]);

  /** 잔여 3회 이하인 활성 회원 — 스케줄표 pill에 재등록 골든벨을 표시하기 위함. */
  const goldenBellMemberIds = useMemo(() => {
    const set = new Set<number>();
    for (const m of members) {
      if (m.status === "active" && m.total_sessions > 0 && m.total_sessions - m.done_count <= 3) {
        set.add(m.id);
      }
    }
    return set;
  }, [members]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionWithMember>();
    for (const s of sessions) {
      map.set(`${s.session_date}-${s.coach_id}-${s.session_hour}`, s);
    }
    return map;
  }, [sessions]);

  const weekStats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === "completed").length;
    const noShow = sessions.filter((s) => s.status === "no_show").length;
    const reserved = sessions.filter((s) => s.status === "reserved").length;
    return { total, completed, noShow, reserved };
  }, [sessions]);

  const selectedDate = dateKeys[selectedDayIdx];

  /** 선택한 날짜의 코치별 PT(1:1)/2:1/상담 카운트 (하단 요약 표용. 개인 일정·수업 불가는 제외). */
  const dailySummary = useMemo(() => {
    const map = new Map<number, { pt: number; pair: number; consultation: number }>();
    for (const coach of visibleCoaches) {
      map.set(coach.id, { pt: 0, pair: 0, consultation: 0 });
    }
    for (const s of sessions) {
      if (s.session_date !== selectedDate) continue;
      const counts = map.get(s.coach_id);
      if (!counts) continue;
      if (s.entry_type === "session") {
        if (s.pt_type === "2:1") counts.pair += 1;
        else counts.pt += 1;
      } else if (s.entry_type === "consultation") {
        counts.consultation += 1;
      }
    }
    return map;
  }, [sessions, selectedDate, visibleCoaches]);

  async function refreshSessions() {
    const weekEnd = dateKeys[6];
    const res = await fetch(`/api/admin/sessions?from=${weekStart}&to=${weekEnd}`);
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions ?? []);
    }
  }

  function goWeek(offsetDays: number) {
    const nextStart = addDaysToKey(weekStart, offsetDays);
    router.push(`/admin/schedule?week=${nextStart}`);
  }

  function goToday() {
    router.push("/admin/schedule");
  }

  return (
    <div>
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "이번 주 전체 세션", value: weekStats.total, color: "text-ink" },
          { label: "예약", value: weekStats.reserved, color: "text-coral" },
          { label: "완료", value: weekStats.completed, color: "text-sage" },
          { label: "노쇼", value: weekStats.noShow, color: "text-red-500" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4"
          >
            <p className="text-xs text-ink/50 mb-2">{card.label}</p>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => goWeek(-7)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
          >
            ‹ 이전 주
          </button>
          <button
            onClick={goToday}
            className="rounded-full bg-ink text-white px-4 py-1.5 text-sm hover:bg-coral transition"
          >
            오늘
          </button>
          <button
            onClick={() => goWeek(7)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
          >
            다음 주 ›
          </button>
          {effectiveCoaches.length > 1 && (
            <select
              value={coachFilter}
              onChange={(e) =>
                setCoachFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm outline-none"
            >
              <option value="all">코치 전체</option>
              {effectiveCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="font-display text-lg">{formatWeekLabel(dateKeys)}</p>
      </div>

      {/* 요일 선택 (데스크톱·모바일 공통) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
        {dateKeys.map((date, dayIdx) => {
          const hours = dayHours[date];
          const isSelected = dayIdx === selectedDayIdx;
          const isToday = date === today;
          return (
            <button
              key={date}
              ref={(el) => {
                dayChipRefs.current[dayIdx] = el;
              }}
              onClick={() => setSelectedDayIdx(dayIdx)}
              className={[
                "shrink-0 rounded-xl px-3 py-2 text-center min-w-[52px] border transition",
                isSelected
                  ? "bg-ink text-white border-ink"
                  : isToday
                    ? "border-coral text-ink bg-white"
                    : "border-line bg-white text-ink/70",
              ].join(" ")}
            >
              <p className="text-[11px]">{WEEKDAY_LABELS[dayIdx]}</p>
              <p className="text-sm font-medium">{Number(date.split("-")[2])}</p>
              {hours?.closed && (
                <p className={`text-[9px] ${isSelected ? "text-white/60" : "text-ink/30"}`}>휴무</p>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택한 날짜 — 코치를 세로 컬럼으로 나열하는 스케줄표 */}
      {(() => {
        const date = selectedDate;
        const hours = dayHours[date];
        const holidayName = holidayMap[date];
        const dayIdx = selectedDayIdx;

        if (hours?.closed) {
          return (
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40 text-sm">
              이 날은 휴무예요.
            </div>
          );
        }
        if (visibleCoaches.length === 0) {
          return (
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40 text-sm">
              코치가 없어요.
            </div>
          );
        }

        const hourList = SCHEDULE_HOUR_ROWS.filter(
          (hour) => hours && hour >= hours.start && hour < hours.end,
        );
        const gridMinWidth = 64 + visibleCoaches.length * 110;

        return (
          <>
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto mb-4">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `64px repeat(${visibleCoaches.length}, minmax(100px, 1fr))`,
                  minWidth: `${gridMinWidth}px`,
                }}
              >
                {/* 날짜 타이틀 */}
                <div className="col-span-full border-b border-line/60 bg-bone/50 px-3 py-2.5 text-center">
                  <p className="font-display text-sm">
                    {date} ({WEEKDAY_LABELS[dayIdx]})
                    {holidayName && <span className="ml-2 text-xs text-coral/70">{holidayName}</span>}
                  </p>
                </div>

                {/* 코치 이름 헤더 행 (코치별 색상 적용) */}
                <div className="border-b border-line/40 bg-bone/30" />
                {visibleCoaches.map((c) => {
                  const palette = coachColorMap.get(c.id);
                  return (
                    <div
                      key={c.id}
                      className={[
                        "border-b border-l-4 border-line/40 px-2 py-2 text-center",
                        palette?.header ?? "bg-bone/30",
                        palette?.accent ?? "",
                      ].join(" ")}
                    >
                      <p className={`text-xs font-medium truncate ${palette?.headerText ?? "text-ink/70"}`}>
                        {c.name}
                      </p>
                    </div>
                  );
                })}

                {/* 시간 행들 — 코치 하나당 컬럼 하나 */}
                {hourList.map((hour) => (
                  <Fragment key={hour}>
                    <div className="border-b border-line/40 px-2 py-2 text-xs text-ink/50 text-right">
                      {hour}:00
                    </div>
                    {visibleCoaches.map((coach) => {
                      const session = sessionMap.get(`${date}-${coach.id}-${hour}`);
                      const palette = coachColorMap.get(coach.id);
                      return (
                        <div
                          key={coach.id}
                          className={[
                            "border-b border-l-4 border-line/40 p-1",
                            palette?.accent ?? "",
                          ].join(" ")}
                        >
                          {session ? (
                            <button
                              onClick={() => setEditTarget(session)}
                              className={[
                                "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:shadow-sm",
                                entryStyle(session),
                              ].join(" ")}
                            >
                              {isSimpleEntry(session) ? (
                                <span className="font-medium block truncate">
                                  {entryIcon(session)}
                                  {entryMainLabel(session)}
                                </span>
                              ) : (
                                <>
                                  <span className="font-medium block truncate">
                                    {entryIcon(session)}
                                    {session.member_name}
                                    {progressLabel(session) && (
                                      <span className="ml-1 font-normal opacity-70">
                                        {progressLabel(session)}
                                      </span>
                                    )}
                                    {session.entry_type === "session" &&
                                      session.member_id !== null &&
                                      goldenBellMemberIds.has(session.member_id) && (
                                        <span className="ml-1" title="재등록 골든타임 — 잔여 3회 이하">
                                          🔔
                                        </span>
                                      )}
                                  </span>
                                  <span className="block text-[10px] opacity-70">
                                    {STATUS_LABEL[session.status]}
                                  </span>
                                  {session.memo && (
                                    <span className="block text-[10px] opacity-60 truncate">
                                      {session.memo}
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => setCreateTarget({ date, hour, coachId: coach.id })}
                              className="w-full rounded-lg border border-dashed border-line px-2 py-1.5 text-left text-xs text-ink/30 hover:text-coral hover:border-coral transition truncate"
                            >
                              + 추가
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* 오늘의 코치별 요약 */}
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{ minWidth: `${gridMinWidth}px` }}
              >
                <thead>
                  <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                    <th className="px-3 py-2 font-medium">구분</th>
                    {visibleCoaches.map((c) => (
                      <th key={c.id} className="px-3 py-2 font-medium text-center">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["pt", "PT"],
                      ["pair", "2:1"],
                      ["consultation", "상담"],
                    ] as const
                  ).map(([key, label]) => (
                    <tr key={key} className="border-b border-line/40 last:border-0">
                      <td className="px-3 py-2 text-ink/60">{label}</td>
                      {visibleCoaches.map((c) => (
                        <td key={c.id} className="px-3 py-2 text-center text-ink/70">
                          {dailySummary.get(c.id)?.[key] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="px-3 py-2">총합</td>
                    {visibleCoaches.map((c) => {
                      const counts = dailySummary.get(c.id);
                      const sum = counts ? counts.pt + counts.pair + counts.consultation : 0;
                      return (
                        <td key={c.id} className="px-3 py-2 text-center">
                          {sum}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {createTarget && (
        <CreateSessionModal
          date={createTarget.date}
          hour={createTarget.hour}
          coachId={createTarget.coachId}
          coaches={effectiveCoaches}
          members={members}
          onClose={() => setCreateTarget(null)}
          onCreated={async () => {
            setCreateTarget(null);
            setLoading(true);
            await refreshSessions();
            setLoading(false);
          }}
        />
      )}

      {editTarget && (
        <EditSessionModal
          session={editTarget}
          coaches={effectiveCoaches}
          onClose={() => setEditTarget(null)}
          onChanged={async () => {
            setEditTarget(null);
            setLoading(true);
            await refreshSessions();
            setLoading(false);
          }}
        />
      )}

      {loading && (
        <p className="text-xs text-ink/40 mt-2">불러오는 중...</p>
      )}
    </div>
  );
}

const DURATION_OPTIONS: Array<{ value: string; weeks: number; label: string }> = [
  { value: "1", weeks: 1, label: "이번 주만" },
  { value: "4", weeks: 4, label: "4주간" },
  { value: "8", weeks: 8, label: "8주간" },
  { value: "12", weeks: 12, label: "12주간" },
];

const NEW_CONTACT = "__new__";

function CreateSessionModal({
  date,
  hour,
  coachId,
  coaches,
  members,
  onClose,
  onCreated,
}: {
  date: string;
  hour: number;
  coachId: number;
  coaches: CoachRow[];
  members: MemberWithProgress[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<SessionEntryType>("session");
  const [ptType, setPtType] = useState<PtType>("1:1");
  const [selectedCoachId, setSelectedCoachId] = useState(coachId);
  const [showOtherCoachMembers, setShowOtherCoachMembers] = useState(false);
  const [memberId, setMemberId] = useState<number | "">("");
  const [useNewContact, setUseNewContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [duration, setDuration] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchCategory(next: SessionEntryType) {
    setCategory(next);
    setMemberId("");
    setUseNewContact(false);
    setNewName("");
    setNewPhone("");
    setError(null);
  }

  function toggleWeekday(idx: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const scopedMembers = members.filter(
    (m) => showOtherCoachMembers || m.coach_id === selectedCoachId,
  );
  const registeredMembers = scopedMembers.filter((m) => m.total_sessions > 0);
  const waitingMembers = scopedMembers.filter((m) => m.total_sessions === 0);

  function computeOccurrences(): string[] {
    if (weekdays.size === 0) return [date];
    const weeks = DURATION_OPTIONS.find((d) => d.value === duration)?.weeks ?? 1;
    const monday = mondayOfWeek(date);
    const result = new Set<string>();
    for (let w = 0; w < weeks; w++) {
      for (const wd of weekdays) {
        const occDate = addDaysToKey(monday, w * 7 + wd);
        if (occDate >= date) result.add(occDate);
      }
    }
    return Array.from(result).sort();
  }

  async function handleSubmit() {
    setError(null);
    if (category === "session" && !memberId) {
      setError("회원을 선택해주세요.");
      return;
    }
    if (category === "consultation") {
      if (useNewContact) {
        if (!newName.trim()) {
          setError("상담자 이름을 입력해주세요.");
          return;
        }
      } else if (!memberId) {
        setError("상담자를 선택하거나 새로 등록해주세요.");
        return;
      }
    }
    if (category === "memo" && !memo.trim()) {
      setError("메모 내용을 입력해주세요.");
      return;
    }

    const occurrences = computeOccurrences();
    setSubmitting(true);

    let resolvedMemberId = typeof memberId === "number" ? memberId : undefined;
    const results: Array<{ date: string; ok: boolean; error?: string }> = [];

    try {
      for (const occDate of occurrences) {
        const body: Record<string, unknown> = {
          entryType: category,
          coachId: selectedCoachId,
          date: occDate,
          hour,
          memo,
        };
        if (category === "session") {
          body.memberId = resolvedMemberId;
          body.ptType = ptType;
        } else if (category === "consultation") {
          if (resolvedMemberId) {
            body.memberId = resolvedMemberId;
          } else {
            body.newName = newName;
            body.newPhone = newPhone;
          }
        }

        const res = await fetch("/api/admin/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          results.push({ date: occDate, ok: true });
          if (category === "consultation" && !resolvedMemberId && data.session?.member_id) {
            resolvedMemberId = data.session.member_id;
          }
        } else {
          results.push({ date: occDate, ok: false, error: data.error });
        }
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    const failCount = results.filter((r) => !r.ok).length;

    if (occurrences.length === 1) {
      if (failCount > 0) {
        setError(results[0].error ?? "등록에 실패했습니다.");
        return;
      }
      onCreated();
      return;
    }

    const successCount = results.length - failCount;
    if (failCount > 0) {
      const failDates = results
        .filter((r) => !r.ok)
        .map((r) => `${r.date}(${r.error ?? "실패"})`)
        .join(", ");
      alert(`${successCount}건 등록 완료, ${failCount}건 실패\n${failDates}`);
    } else {
      alert(`${successCount}건 등록 완료`);
    }
    onCreated();
  }

  return (
    <ModalShell title={`새 일정 — ${date} ${hour}:00`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1 rounded-full bg-bone/70 p-1 text-xs">
          {(Object.keys(CATEGORY_LABELS) as SessionEntryType[]).map((cat) => (
            <button
              key={cat}
              onClick={() => switchCategory(cat)}
              className={[
                "rounded-full py-1.5 font-medium transition text-center",
                category === cat ? "bg-coral text-white shadow-sm" : "text-ink/60",
              ].join(" ")}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {coaches.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">담당 코치</label>
            <select
              value={selectedCoachId}
              onChange={(e) => {
                setSelectedCoachId(Number(e.target.value));
                setMemberId("");
              }}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            >
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-1.5 text-xs text-ink/60">
              <input
                type="checkbox"
                checked={showOtherCoachMembers}
                onChange={(e) => setShowOtherCoachMembers(e.target.checked)}
              />
              다른 코치 회원도 표시
            </label>
          </div>
        )}

        {category === "session" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5">수업 형태</label>
              <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
                {(["1:1", "2:1"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPtType(t)}
                    className={[
                      "flex-1 rounded-full py-1.5 font-medium transition",
                      ptType === t ? "bg-coral text-white shadow-sm" : "text-ink/60",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">회원 선택</label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              >
                <option value="">선택해주세요</option>
                {registeredMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {category === "consultation" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">상담 대상</label>
            <select
              value={useNewContact ? NEW_CONTACT : memberId}
              onChange={(e) => {
                if (e.target.value === NEW_CONTACT) {
                  setUseNewContact(true);
                  setMemberId("");
                } else {
                  setUseNewContact(false);
                  setMemberId(e.target.value ? Number(e.target.value) : "");
                }
              }}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            >
              <option value="">선택해주세요</option>
              {waitingMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value={NEW_CONTACT}>+ 새 상담자 등록</option>
            </select>
            {useNewContact && (
              <div className="mt-2 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="이름"
                  className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="연락처 (선택)"
                  className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
                />
              </div>
            )}
          </div>
        )}

        {(category === "session" || category === "consultation") && (
          <div>
            <label className="block text-sm font-medium mb-1.5">메모</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              placeholder="선택 입력"
            />
          </div>
        )}

        {category === "memo" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">메모 내용</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              placeholder="예: 개인 운동 시간, 외부 일정 등"
            />
            <p className="text-xs text-ink/40 mt-1.5">
              회원 예약 없이 이 시간대를 비워두고 싶을 때 사용하세요.
            </p>
          </div>
        )}

        {category === "blocked" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">사유</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              placeholder="예: 병가, 휴가 등 (선택 입력)"
            />
            <p className="text-xs text-ink/40 mt-1.5">
              해당 시간에 예약이 들어오지 않도록 막아둡니다.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">고정 요일</label>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, idx) => (
              <button
                key={label}
                onClick={() => toggleWeekday(idx)}
                className={[
                  "rounded-lg border py-1.5 text-xs font-medium transition",
                  weekdays.has(idx)
                    ? "bg-ink text-white border-ink"
                    : "border-line text-ink/60 hover:bg-bone",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink/40 mt-1.5">
            선택한 요일에 매주 반복 등록합니다. (선택하지 않으면 이 날짜에만 등록)
          </p>
        </div>

        {weekdays.size > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">반복 기간</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-line py-2.5 font-medium hover:bg-bone transition"
          >
            닫기
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "예약 추가"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditSessionModal({
  session,
  coaches,
  onClose,
  onChanged,
}: {
  session: SessionWithMember;
  coaches: CoachRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [memo, setMemo] = useState(session.memo);
  const [coachId, setCoachId] = useState(session.coach_id);
  const [ptType, setPtType] = useState<PtType>(session.pt_type);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "처리 중 오류가 발생했습니다.");
        return;
      }
      onChanged();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 일정을 완전히 삭제할까요?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  if (isSimpleEntry(session)) {
    return (
      <ModalShell
        title={`${CATEGORY_LABELS[session.entry_type]} — ${session.session_date} ${session.session_hour}:00`}
        onClose={onClose}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {session.entry_type === "blocked" ? "사유" : "메모 내용"}
            </label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            disabled={submitting}
            onClick={() => patch({ memo })}
            className="w-full rounded-full bg-ink text-white py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
          >
            저장
          </button>
          <button
            disabled={submitting}
            onClick={handleDelete}
            className="w-full text-sm text-red-500 hover:underline"
          >
            삭제
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={`${session.member_name} — ${session.session_date} ${session.session_hour}:00`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink/60">
          {session.entry_type === "consultation" && (
            <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              상담
            </span>
          )}
          현재 상태: <span className="font-medium text-ink">{STATUS_LABEL[session.status]}</span>
          {progressLabel(session) && (
            <span className="ml-2 text-ink/50">· 회차 {progressLabel(session)}</span>
          )}
        </p>

        {coaches.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">담당 코치</label>
            <select
              value={coachId}
              onChange={(e) => setCoachId(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            >
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {session.entry_type === "session" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">수업 형태</label>
            <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
              {(["1:1", "2:1"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPtType(t)}
                  className={[
                    "flex-1 rounded-full py-1.5 font-medium transition",
                    ptType === t ? "bg-coral text-white shadow-sm" : "text-ink/60",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">메모</label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={submitting}
            onClick={() => patch({ status: "completed" })}
            className="rounded-full bg-sage/80 text-white py-2 text-sm font-medium hover:bg-sage transition disabled:opacity-50"
          >
            ✓ 수업 완료
          </button>
          <button
            disabled={submitting}
            onClick={() => patch({ status: "no_show" })}
            className="rounded-full bg-red-400 text-white py-2 text-sm font-medium hover:bg-red-500 transition disabled:opacity-50"
          >
            ✕ 노쇼 처리
          </button>
          <button
            disabled={submitting}
            onClick={() => patch({ status: "cancelled" })}
            className="rounded-full border border-line py-2 text-sm hover:bg-bone transition disabled:opacity-50"
          >
            취소 (차감 없음)
          </button>
          <button
            disabled={submitting}
            onClick={() =>
              patch(
                session.entry_type === "session" ? { memo, coachId, ptType } : { memo, coachId },
              )
            }
            className="rounded-full border border-line py-2 text-sm hover:bg-bone transition disabled:opacity-50"
          >
            메모·담당 저장
          </button>
        </div>

        <button
          disabled={submitting}
          onClick={handleDelete}
          className="w-full text-sm text-red-500 hover:underline mt-2"
        >
          기록 삭제
        </button>
      </div>
    </ModalShell>
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
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
