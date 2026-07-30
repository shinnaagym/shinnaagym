"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COACH_COLOR_PALETTE, SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import { addDaysToKey, mondayOfWeek } from "@/lib/date";
import type { CoachRow, PtType, ScheduleMemoRow, SessionEntryType, SessionStatus } from "@/lib/db";
import type { CoachScheduleStats, MemberWithProgress } from "@/lib/schedule";
import type { DayHours } from "@/lib/constants";
import { ScheduleMemoPad } from "./schedule-memo-pad";

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
  no_show: "bg-red-50 border-red-300 text-red-700 line-through",
  cancelled: "bg-transparent border-dashed border-line text-ink/30 line-through",
};

const MEMO_STYLE = "bg-violet-50 border-violet-200 text-violet-700";
const CONSULT_STYLE = "bg-amber-50 border-amber-300 text-amber-800";
const BLOCKED_STYLE = "bg-ink/5 border-ink/25 text-ink/50";

const STATUS_LABEL: Record<SessionStatus, string> = {
  reserved: "예약",
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

function SessionCellButton({
  session,
  goldenBellMemberIds,
  onEdit,
  onCreate,
}: {
  session: SessionWithMember | undefined;
  goldenBellMemberIds: Set<number>;
  onEdit: (session: SessionWithMember) => void;
  onCreate: () => void;
}) {
  if (!session) {
    return (
      <button
        onClick={onCreate}
        className="w-full rounded-lg border border-dashed border-line px-2 py-1.5 text-left text-xs text-ink/30 hover:text-coral hover:border-coral transition truncate"
      >
        + 추가
      </button>
    );
  }
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(session.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onEdit(session)}
      className={[
        "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:shadow-sm cursor-grab active:cursor-grabbing",
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
              <span className="ml-1 font-normal opacity-70">{progressLabel(session)}</span>
            )}
            {session.entry_type === "session" &&
              session.member_id !== null &&
              goldenBellMemberIds.has(session.member_id) && (
                <span className="ml-1" title="재등록 골든타임 — 잔여 3회 이하">
                  🔔
                </span>
              )}
          </span>
          <span className="block text-[10px] opacity-70">{STATUS_LABEL[session.status]}</span>
          {session.memo && (
            <span className="block text-[10px] opacity-60 truncate">{session.memo}</span>
          )}
        </>
      )}
    </button>
  );
}

function formatWeekLabel(dateKeys: string[]) {
  const [, m1, d1] = dateKeys[0].split("-");
  const [, m2, d2] = dateKeys[dateKeys.length - 1].split("-");
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
  coachStats,
  initialMemos,
}: {
  weekStart: string;
  dateKeys: string[];
  today: string;
  coaches: CoachRow[];
  members: MemberWithProgress[];
  initialSessions: SessionWithMember[];
  dayHours: Record<string, DayHours>;
  holidayMap: Record<string, string>;
  coachStats: Record<number, CoachScheduleStats>;
  initialMemos: ScheduleMemoRow[];
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
  const [coachFilter, setCoachFilter] = useState<number | "all">("all");
  const allGridScrollRef = useRef<HTMLDivElement | null>(null);

  const effectiveCoaches = coaches.length > 0 ? coaches : [];
  const visibleCoaches =
    coachFilter === "all" ? effectiveCoaches : effectiveCoaches.filter((c) => c.id === coachFilter);
  /** 코치를 한 명만 선택하면 요일 탭 대신 그 코치의 이번 주 전체를 한 화면에 보여준다. */
  const singleCoach =
    coachFilter !== "all" ? (effectiveCoaches.find((c) => c.id === coachFilter) ?? null) : null;

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

  /** "코치 전체"를 볼 때 KPI 카드에 쓰는, 전체 코치 합산 통계(이번 달/이번 주). */
  const totalStats = useMemo(() => {
    return Object.values(coachStats).reduce(
      (acc, s) => ({
        monthPt: acc.monthPt + s.monthPt,
        monthPair: acc.monthPair + s.monthPair,
        weekPt: acc.weekPt + s.weekPt,
        weekPair: acc.weekPair + s.weekPair,
        monthConsultation: acc.monthConsultation + s.monthConsultation,
        monthNoShowSession: acc.monthNoShowSession + s.monthNoShowSession,
        monthNoShowConsultation: acc.monthNoShowConsultation + s.monthNoShowConsultation,
      }),
      {
        monthPt: 0,
        monthPair: 0,
        weekPt: 0,
        weekPair: 0,
        monthConsultation: 0,
        monthNoShowSession: 0,
        monthNoShowConsultation: 0,
      },
    );
  }, [coachStats]);

  /** 코치 한 명을 필터로 골랐을 때(주간 보기) 이번 주 전체의 PT/2:1/상담 합계. */
  const weeklySummary = useMemo(() => {
    const map = new Map<number, { pt: number; pair: number; consultation: number }>();
    for (const coach of visibleCoaches) {
      map.set(coach.id, { pt: 0, pair: 0, consultation: 0 });
    }
    for (const s of sessions) {
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
  }, [sessions, visibleCoaches]);

  /** "코치 전체" 주간 그리드를 열면 항상 월요일부터 보이는데, 오늘 요일이 화면
      밖에 있을 수 있어 처음부터 오늘 요일이 보이도록 가로 스크롤을 맞춰준다. */
  useEffect(() => {
    if (coachFilter !== "all") return;
    const container = allGridScrollRef.current;
    if (!container) return;
    const todayCell = container.querySelector<HTMLElement>(`[data-date="${today}"]`);
    if (!todayCell) return;
    const offset =
      todayCell.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      container.scrollLeft;
    container.scrollLeft = Math.max(0, offset - 64);
  }, [coachFilter, dateKeys, today]);

  async function refreshSessions() {
    const weekEnd = dateKeys[dateKeys.length - 1];
    const res = await fetch(`/api/admin/sessions?from=${weekStart}&to=${weekEnd}`);
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions ?? []);
    }
  }

  /** 일정 pill을 드래그해서 다른 시간/코치 칸에 놓으면 그 칸으로 이동시킨다. */
  async function handleDropOnCell(
    e: React.DragEvent,
    targetDate: string,
    targetHour: number,
    targetCoachId: number,
  ) {
    e.preventDefault();
    const sessionId = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(sessionId)) return;

    const existing = sessionMap.get(`${targetDate}-${targetCoachId}-${targetHour}`);
    if (existing?.id === sessionId) return;
    if (existing) {
      alert("이미 일정이 있는 시간이에요.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: targetDate, hour: targetHour, coachId: targetCoachId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "이동 중 오류가 발생했습니다.");
    }
    await refreshSessions();
    setLoading(false);
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
      {/* KPI 카드 — 코치를 한 명 선택하면 그 코치의, "코치 전체"면 전체 합산 이번 달/이번 주 통계를 보여준다. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(() => {
          const stats = singleCoach ? coachStats[singleCoach.id] : totalStats;
          return [
            {
              label: "이번 달 수업수",
              value: (stats?.monthPt ?? 0) + (stats?.monthPair ?? 0),
              detail: `1:1 ${stats?.monthPt ?? 0}회 · 2:1 ${stats?.monthPair ?? 0}회`,
              color: "text-ink",
            },
            {
              label: "이번 주 수업수",
              value: (stats?.weekPt ?? 0) + (stats?.weekPair ?? 0),
              detail: `1:1 ${stats?.weekPt ?? 0}회 · 2:1 ${stats?.weekPair ?? 0}회`,
              color: "text-coral",
            },
            {
              label: "이번달 상담수",
              value: stats?.monthConsultation ?? 0,
              detail: null,
              color: "text-sage",
            },
            {
              label: "이번달 노쇼",
              value: (stats?.monthNoShowSession ?? 0) + (stats?.monthNoShowConsultation ?? 0),
              detail: `PT ${stats?.monthNoShowSession ?? 0}회 · 상담 ${stats?.monthNoShowConsultation ?? 0}회`,
              color: "text-red-500",
            },
          ];
        })().map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4"
          >
            <p className="text-xs text-ink/50 mb-2">{card.label}</p>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
            {card.detail && <p className="text-xs text-ink/40 mt-1">{card.detail}</p>}
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

      <ScheduleMemoPad initialMemos={initialMemos} />

      {/* 코치를 한 명만 선택하면 그 코치의 이번 주 전체를 한 번에 보여준다. */}
      {singleCoach ? (
        <>
          <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto mb-4">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `64px repeat(${dateKeys.length}, minmax(100px, 1fr))`,
                minWidth: `${64 + dateKeys.length * 110}px`,
              }}
            >
              <div className="col-span-full border-b border-line/60 bg-bone/50 px-3 py-2.5 text-center">
                <p className="font-display text-sm">
                  {singleCoach.name} 코치 · 이번 주 전체 ({formatWeekLabel(dateKeys)})
                </p>
              </div>

              <div className="border-b border-line/40 bg-bone/30" />
              {dateKeys.map((d, i) => {
                const isToday = d === today;
                const closed = dayHours[d]?.closed;
                return (
                  <div
                    key={d}
                    className={[
                      "border-b border-line/40 px-2 py-2 text-center",
                      isToday ? "bg-coral/10" : "bg-bone/30",
                    ].join(" ")}
                  >
                    <p className="text-xs font-medium truncate">
                      {WEEKDAY_LABELS[i]} {Number(d.split("-")[2])}
                    </p>
                    {closed && <p className="text-[9px] text-ink/30">휴무</p>}
                    {holidayMap[d] && !closed && (
                      <p className="text-[9px] text-coral/70 truncate">{holidayMap[d]}</p>
                    )}
                  </div>
                );
              })}

              {SCHEDULE_HOUR_ROWS.map((hour) => (
                <Fragment key={hour}>
                  <div className="border-b border-line/40 px-2 py-2 text-xs text-ink/50 text-right">
                    {hour}:00
                  </div>
                  {dateKeys.map((d) => {
                    const dh = dayHours[d];
                    const withinHours = !!dh && !dh.closed && hour >= dh.start && hour < dh.end;
                    const session = sessionMap.get(`${d}-${singleCoach.id}-${hour}`);
                    return (
                      <div
                        key={d}
                        className="border-b border-line/40 p-1"
                        onDragOver={withinHours ? (e) => e.preventDefault() : undefined}
                        onDrop={
                          withinHours
                            ? (e) => handleDropOnCell(e, d, hour, singleCoach.id)
                            : undefined
                        }
                      >
                        {withinHours ? (
                          <SessionCellButton
                            session={session}
                            goldenBellMemberIds={goldenBellMemberIds}
                            onEdit={setEditTarget}
                            onCreate={() => setCreateTarget({ date: d, hour, coachId: singleCoach.id })}
                          />
                        ) : (
                          <div className="w-full rounded-lg px-2 py-1.5 text-center text-[11px] text-ink/15">
                            ·
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-3 py-2 font-medium">이번 주 구분</th>
                  <th className="px-3 py-2 font-medium text-center">{singleCoach.name}</th>
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
                    <td className="px-3 py-2 text-center text-ink/70">
                      {weeklySummary.get(singleCoach.id)?.[key] ?? 0}
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-3 py-2">총합</td>
                  <td className="px-3 py-2 text-center">
                    {(() => {
                      const counts = weeklySummary.get(singleCoach.id);
                      return counts ? counts.pt + counts.pair + counts.consultation : 0;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
      /* 코치 전체 — 이번 주 전체를 한 화면에 보여주되, 요일마다 코치별로 세로 열을
         나눠서 배치한다(요일 > 코치 순 중첩 열). 열 수가 많아 화면 밖으로
         넘어가면 좌우 스크롤(드래그/스와이프)로 볼 수 있다. */
      (() => {
        if (visibleCoaches.length === 0) {
          return (
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40 text-sm">
              코치가 없어요.
            </div>
          );
        }

        const nCoaches = effectiveCoaches.length;
        const totalCols = dateKeys.length * nCoaches;
        const gridMinWidth = 64 + totalCols * 100;

        return (
          <div
            ref={allGridScrollRef}
            className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto mb-4"
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `64px repeat(${totalCols}, minmax(100px, 1fr))`,
                minWidth: `${gridMinWidth}px`,
              }}
            >
              <div className="col-span-full border-b border-line/60 bg-bone/50 px-3 py-2.5 text-center">
                <p className="font-display text-sm">이번 주 전체 ({formatWeekLabel(dateKeys)})</p>
              </div>

              <div className="border-b border-line/40 bg-bone/30" />
              {dateKeys.map((d, i) => {
                const isToday = d === today;
                const closed = dayHours[d]?.closed;
                return (
                  <div
                    key={d}
                    data-date={d}
                    style={{ gridColumn: `span ${nCoaches}` }}
                    className={[
                      "border-b border-l-2 border-ink/25 px-2 py-2 text-center",
                      isToday ? "bg-coral/10" : "bg-bone/30",
                    ].join(" ")}
                  >
                    <p className="text-xs font-medium truncate">
                      {WEEKDAY_LABELS[i]} {Number(d.split("-")[2])}
                    </p>
                    {closed && <p className="text-[9px] text-ink/30">휴무</p>}
                    {holidayMap[d] && !closed && (
                      <p className="text-[9px] text-coral/70 truncate">{holidayMap[d]}</p>
                    )}
                  </div>
                );
              })}

              {nCoaches > 1 && (
                <>
                  <div className="border-b border-line/40 bg-bone/30" />
                  {dateKeys.map((d) =>
                    effectiveCoaches.map((c, ci) => {
                      const palette = coachColorMap.get(c.id);
                      return (
                        <div
                          key={`${d}-${c.id}`}
                          className={[
                            "border-b py-1 text-center",
                            ci === 0 ? "border-l-2 border-ink/25" : "border-l border-line/20",
                            palette?.header ?? "bg-bone/20",
                          ].join(" ")}
                        >
                          <p className={`text-[10px] font-medium truncate px-1 ${palette?.headerText ?? "text-ink/50"}`}>
                            {c.name}
                          </p>
                        </div>
                      );
                    }),
                  )}
                </>
              )}

              {SCHEDULE_HOUR_ROWS.map((hour) => (
                <Fragment key={hour}>
                  <div className="border-b border-line/40 px-2 py-2 text-xs text-ink/50 text-right">
                    {hour}:00
                  </div>
                  {dateKeys.map((d) => {
                    const dh = dayHours[d];
                    const withinHours = !!dh && !dh.closed && hour >= dh.start && hour < dh.end;
                    return effectiveCoaches.map((coach, ci) => {
                      const session = withinHours
                        ? sessionMap.get(`${d}-${coach.id}-${hour}`)
                        : undefined;
                      return (
                        <div
                          key={`${d}-${coach.id}`}
                          className={[
                            "border-b p-1",
                            ci === 0 ? "border-l-2 border-ink/25" : "border-l border-line/20",
                          ].join(" ")}
                          onDragOver={withinHours ? (e) => e.preventDefault() : undefined}
                          onDrop={
                            withinHours ? (e) => handleDropOnCell(e, d, hour, coach.id) : undefined
                          }
                        >
                          {!withinHours ? (
                            <div className="w-full rounded-lg px-2 py-1.5 text-center text-[11px] text-ink/15">
                              ·
                            </div>
                          ) : (
                            <SessionCellButton
                              session={session}
                              goldenBellMemberIds={goldenBellMemberIds}
                              onEdit={setEditTarget}
                              onCreate={() => setCreateTarget({ date: d, hour, coachId: coach.id })}
                            />
                          )}
                        </div>
                      );
                    });
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        );
      })()
      )}

      {createTarget && (
        <CreateSessionModal
          date={createTarget.date}
          hour={createTarget.hour}
          maxHour={dayHours[createTarget.date]?.end ?? createTarget.hour + 1}
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
  maxHour,
  coachId,
  coaches,
  members,
  onClose,
  onCreated,
}: {
  date: string;
  hour: number;
  maxHour: number;
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
  const [endHour, setEndHour] = useState(hour + 1);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [duration, setDuration] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const endHourOptions = Array.from(
    { length: Math.max(0, maxHour - hour) },
    (_, i) => hour + 1 + i,
  );
  const hoursInRange = Array.from({ length: endHour - hour }, (_, i) => hour + i);

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
    const hoursToCreate = category === "memo" || category === "blocked" ? hoursInRange : [hour];
    setSubmitting(true);

    let resolvedMemberId = typeof memberId === "number" ? memberId : undefined;
    const results: Array<{ date: string; hour: number; ok: boolean; error?: string }> = [];

    try {
      for (const occDate of occurrences) {
        for (const occHour of hoursToCreate) {
          const body: Record<string, unknown> = {
            entryType: category,
            coachId: selectedCoachId,
            date: occDate,
            hour: occHour,
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
            results.push({ date: occDate, hour: occHour, ok: true });
            if (category === "consultation" && !resolvedMemberId && data.session?.member_id) {
              resolvedMemberId = data.session.member_id;
            }
          } else {
            results.push({ date: occDate, hour: occHour, ok: false, error: data.error });
          }
        }
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    const failCount = results.filter((r) => !r.ok).length;

    if (results.length === 1) {
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
        .map((r) => `${r.date} ${r.hour}:00(${r.error ?? "실패"})`)
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
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setMemberId(id);
                  const selected = registeredMembers.find((m) => m.id === id);
                  if (selected) setPtType(selected.latest_pt_type);
                }}
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

        {(category === "memo" || category === "blocked") && endHourOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">종료 시간</label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            >
              {endHourOptions.map((eh) => (
                <option key={eh} value={eh}>
                  {eh}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-ink/40 mt-1.5">
              {hour}:00부터 {endHour}:00 전까지 시간대를 한 번에 등록합니다.
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

/** 일정 상세 모달에서 드래그 대신(또는 함께) 쓸 수 있는 명시적 "이동" 폼 —
    날짜·시간·코치를 직접 골라 다른 칸으로 옮긴다. */
function MoveSessionSection({
  coaches,
  showMove,
  onToggle,
  moveDate,
  onMoveDateChange,
  moveHour,
  onMoveHourChange,
  moveCoachId,
  onMoveCoachIdChange,
  submitting,
  onMove,
}: {
  coaches: CoachRow[];
  showMove: boolean;
  onToggle: (next: boolean) => void;
  moveDate: string;
  onMoveDateChange: (v: string) => void;
  moveHour: number;
  onMoveHourChange: (v: number) => void;
  moveCoachId: number;
  onMoveCoachIdChange: (v: number) => void;
  submitting: boolean;
  onMove: () => void;
}) {
  if (!showMove) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        className="w-full rounded-full border border-line py-2.5 text-sm font-medium hover:border-coral/40 hover:text-coral transition"
      >
        📅 다른 날짜·시간으로 이동
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-line/60 bg-bone/30 p-3">
      <p className="text-sm font-medium">이동할 날짜·시간</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={moveDate}
          onChange={(e) => onMoveDateChange(e.target.value)}
          className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
        />
        <select
          value={moveHour}
          onChange={(e) => onMoveHourChange(Number(e.target.value))}
          className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
        >
          {SCHEDULE_HOUR_ROWS.map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </select>
      </div>
      {coaches.length > 1 && (
        <select
          value={moveCoachId}
          onChange={(e) => onMoveCoachIdChange(Number(e.target.value))}
          className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
        >
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="flex-1 rounded-full border border-line py-2 text-sm hover:bg-bone transition"
        >
          취소
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onMove}
          className="flex-1 rounded-full bg-ink text-white py-2 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          이동
        </button>
      </div>
    </div>
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
  const [showMove, setShowMove] = useState(false);
  const [moveDate, setMoveDate] = useState(session.session_date);
  const [moveHour, setMoveHour] = useState(session.session_hour);
  const [moveCoachId, setMoveCoachId] = useState(session.coach_id);

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

          <MoveSessionSection
            coaches={coaches}
            showMove={showMove}
            onToggle={setShowMove}
            moveDate={moveDate}
            onMoveDateChange={setMoveDate}
            moveHour={moveHour}
            onMoveHourChange={setMoveHour}
            moveCoachId={moveCoachId}
            onMoveCoachIdChange={setMoveCoachId}
            submitting={submitting}
            onMove={() => patch({ date: moveDate, hour: moveHour, coachId: moveCoachId })}
          />

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
            onClick={() => patch({ status: "no_show" })}
            className="rounded-full bg-red-400 text-white py-2 text-sm font-medium hover:bg-red-500 transition disabled:opacity-50"
          >
            ✕ 노쇼 처리(차감)
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
            className="col-start-2 rounded-full border border-line py-2 text-sm hover:bg-bone transition disabled:opacity-50"
          >
            메모·담당 저장
          </button>
        </div>

        <MoveSessionSection
          coaches={coaches}
          showMove={showMove}
          onToggle={setShowMove}
          moveDate={moveDate}
          onMoveDateChange={setMoveDate}
          moveHour={moveHour}
          onMoveHourChange={setMoveHour}
          moveCoachId={moveCoachId}
          onMoveCoachIdChange={setMoveCoachId}
          submitting={submitting}
          onMove={() => patch({ date: moveDate, hour: moveHour, coachId: moveCoachId })}
        />

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
