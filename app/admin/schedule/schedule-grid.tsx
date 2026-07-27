"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import { addDaysToKey, mondayOfWeek } from "@/lib/date";
import type { CoachRow, SessionEntryType, SessionStatus } from "@/lib/db";
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
  const showCoachLabel = visibleCoaches.length > 1;

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

  const dataColumns = dateKeys.length;

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

      {/* 모바일: 요일 선택 + 하루치 세로 목록 */}
      <div className="sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
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

        {(() => {
          const date = dateKeys[selectedDayIdx];
          const hours = dayHours[date];
          const holidayName = holidayMap[date];
          if (hours?.closed) {
            return (
              <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40 text-sm">
                이 날은 휴무예요.
              </div>
            );
          }
          const coachColumns = visibleCoaches.length > 0 ? visibleCoaches : [null];
          return (
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm divide-y divide-line/40 overflow-hidden">
              {holidayName && (
                <p className="px-4 py-2 text-xs text-coral/70 bg-coral/5">{holidayName}</p>
              )}
              {showCoachLabel && (
                <div className="flex gap-2 px-4 py-2 bg-bone/40">
                  <span className="w-10 shrink-0" />
                  <div
                    className="flex-1 grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${coachColumns.length}, 1fr)` }}
                  >
                    {visibleCoaches.map((c) => (
                      <p
                        key={c.id}
                        className="text-xs font-medium text-ink/60 text-center truncate"
                      >
                        {c.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {SCHEDULE_HOUR_ROWS.filter(
                (hour) => hours && hour >= hours.start && hour < hours.end,
              ).map((hour) => (
                <div key={hour} className="flex gap-2 px-4 py-3">
                  <span className="w-10 shrink-0 text-xs text-ink/50 pt-2">{hour}:00</span>
                  <div
                    className="flex-1 grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${coachColumns.length}, 1fr)` }}
                  >
                    {coachColumns.map((coach) => {
                      const session = coach
                        ? sessionMap.get(`${date}-${coach.id}-${hour}`)
                        : undefined;
                      return (
                        <div key={coach?.id ?? "x"}>
                          {session ? (
                            <button
                              onClick={() => setEditTarget(session)}
                              className={[
                                "w-full rounded-lg border px-2.5 py-2 text-left text-xs",
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
                          ) : coach ? (
                            <button
                              onClick={() => setCreateTarget({ date, hour, coachId: coach.id })}
                              className="w-full rounded-lg border border-dashed border-line px-2.5 py-2 text-left text-xs text-ink/30 hover:text-coral hover:border-coral transition truncate"
                            >
                              + 추가
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 데스크톱: 그리드 */}
      <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
        <div
          className="grid min-w-[720px]"
          style={{ gridTemplateColumns: `64px repeat(${dataColumns}, minmax(120px, 1fr))` }}
        >
          {/* 헤더 행 — 날짜 하나당 컬럼 하나 (코치별로 반복하지 않음) */}
          <div className="border-b border-line/60 bg-bone/40" />
          {dateKeys.map((date, dayIdx) => {
            const hours = dayHours[date];
            const holidayName = holidayMap[date];
            const isToday = date === today;
            const isSun = dayIdx === 6;
            return (
              <div
                key={date}
                className={[
                  "border-b border-l border-line/40 px-2 py-2 text-center",
                  isToday ? "bg-coral/5" : "bg-bone/40",
                ].join(" ")}
              >
                <p
                  className={[
                    "text-xs font-medium",
                    isSun ? "text-red-400" : dayIdx === 5 ? "text-sky-500" : "text-ink/70",
                  ].join(" ")}
                >
                  {Number(date.split("-")[2])}일 ({WEEKDAY_LABELS[dayIdx]})
                </p>
                {hours?.closed ? (
                  <p className="text-[11px] text-ink/30 mt-0.5">휴무</p>
                ) : holidayName ? (
                  <p className="text-[11px] text-coral/70 mt-0.5">{holidayName}</p>
                ) : null}
              </div>
            );
          })}

          {/* 시간 행들 — 날짜당 셀 하나. 코치가 여럿 보이면 그 안에 코치별로 쌓아서 표시 */}
          {SCHEDULE_HOUR_ROWS.map((hour) => (
            <Fragment key={hour}>
              <div
                className="border-b border-line/40 px-2 py-2 text-xs text-ink/50 text-right"
              >
                {hour}:00
              </div>
              {dateKeys.map((date) => {
                const hours = dayHours[date];
                const withinHours = hours && !hours.closed && hour >= hours.start && hour < hours.end;
                const key = `${date}-${hour}`;

                if (!withinHours) {
                  return (
                    <div
                      key={key}
                      className="border-b border-line/40 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#eee_6px,#eee_7px)]"
                    />
                  );
                }

                if (visibleCoaches.length === 0) {
                  return <div key={key} className="border-b border-line/40" />;
                }

                // 코치 1명만 보이는 경우: 기존처럼 큰 pill 하나
                if (visibleCoaches.length === 1) {
                  const coach = visibleCoaches[0];
                  const session = sessionMap.get(`${date}-${coach.id}-${hour}`);

                  if (session) {
                    return (
                      <button
                        key={key}
                        onClick={() => setEditTarget(session)}
                        className={[
                          "border-b border-line/40 m-1 rounded-lg border px-1.5 py-1 text-[11px] text-left transition hover:shadow-sm",
                          entryStyle(session),
                        ].join(" ")}
                      >
                        {isSimpleEntry(session) ? (
                          <p className="font-medium truncate">
                            {entryIcon(session)}
                            {entryMainLabel(session)}
                          </p>
                        ) : (
                          <>
                            <p className="font-medium truncate">
                              {entryIcon(session)}
                              {session.member_name}
                              {progressLabel(session) && (
                                <span className="ml-1 font-normal opacity-70">
                                  {progressLabel(session)}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] opacity-70">{STATUS_LABEL[session.status]}</p>
                            {session.memo && (
                              <p className="text-[10px] opacity-60 truncate">{session.memo}</p>
                            )}
                          </>
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => setCreateTarget({ date, hour, coachId: coach.id })}
                      className="border-b border-line/40 text-ink/15 hover:text-coral hover:bg-coral/5 transition flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  );
                }

                // 코치 여럿이 보이는 경우: 한 셀 안에 코치별로 작은 줄을 쌓아서 표시
                return (
                  <div
                    key={key}
                    className="border-b border-line/40 flex flex-col gap-0.5 p-1"
                  >
                    {visibleCoaches.map((coach) => {
                      const session = sessionMap.get(`${date}-${coach.id}-${hour}`);
                      const initial = coach.name.slice(0, 1);

                      if (session) {
                        const label = `${entryIcon(session)}${entryMainLabel(session)}`;
                        return (
                          <button
                            key={coach.id}
                            onClick={() => setEditTarget(session)}
                            title={`${coach.name} · ${label}`}
                            className={[
                              "rounded border px-1 py-0.5 text-left text-[10px] leading-tight truncate transition hover:shadow-sm",
                              entryStyle(session),
                            ].join(" ")}
                          >
                            <span className="opacity-50">{initial}·</span>
                            {label}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={coach.id}
                          onClick={() => setCreateTarget({ date, hour, coachId: coach.id })}
                          title={`${coach.name} 예약 추가`}
                          className="rounded border border-dashed border-line/70 px-1 py-0.5 text-left text-[10px] text-ink/25 hover:text-coral hover:border-coral transition truncate"
                        >
                          +{initial}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

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
            onClick={() => patch({ memo, coachId })}
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
