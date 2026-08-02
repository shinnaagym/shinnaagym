"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COACH_COLOR_PALETTE, SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import type { CoachRow, PtType, ScheduleMemoRow, SessionEntryType, SessionStatus } from "@/lib/db";
import type { CoachScheduleStats, CoachWorkingHours, MemberWithProgress } from "@/lib/schedule";
import type { DayHours } from "@/lib/constants";
import { MemoPad } from "../memo-pad";

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
  reserved: "bg-sky-100 border-sky-400 text-sky-900",
  no_show: "bg-red-100 border-red-400 text-red-800 line-through",
  cancelled: "bg-transparent border-dashed border-line text-ink/30 line-through",
  done: "bg-sky-100 border-sky-400 text-sky-900 line-through",
};

const MEMO_STYLE = "bg-violet-200 border-violet-500 text-violet-900";
const MEMO_DONE_STYLE = "bg-violet-100 border-violet-400 text-violet-700 line-through";
const CONSULT_STYLE = "bg-amber-200 border-amber-500 text-amber-900";
const BLOCKED_STYLE = "bg-slate-300 border-slate-600 text-slate-900";

const STATUS_LABEL: Record<SessionStatus, string> = {
  reserved: "예약",
  no_show: "노쇼",
  cancelled: "취소",
  done: "완료",
};

/** 일정 pill의 배경/테두리 스타일. 상담·메모·수업불가는 상태와 무관하게 고정 톤을 쓴다(취소·완료 제외).
    개인 일정(memo)을 완료 처리하면 제목에 취소선을 그어 한눈에 끝난 일정임을 알 수 있게 한다. */
function entryStyle(session: SessionWithMember): string {
  if (session.entry_type === "memo") return session.status === "done" ? MEMO_DONE_STYLE : MEMO_STYLE;
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

/** 재등록 골든벨은 회원 단위 자격(잔여 ≤ 3회)뿐 아니라, 이 세션 pill 자체의
    회차도 "총 회차 - 이 회차 ≤ 3"이어야 뜬다 — 그래야 예: "3/10"(잔여 7회
    시점)처럼 한참 이른 회차의 pill에까지 종 아이콘이 잘못 붙는 일이 없다. */
function isGoldenBellSession(session: SessionWithMember, goldenBellMemberIds: Set<number>): boolean {
  if (session.entry_type !== "session" || session.member_id === null) return false;
  if (!goldenBellMemberIds.has(session.member_id)) return false;
  const total = Number(session.total_sessions);
  if (!total || session.ordinal === null) return false;
  return total - session.ordinal <= 3;
}

function SessionCellButton({
  session,
  goldenBellMemberIds,
  onEdit,
  onCreate,
  mergedSessions,
  onEditMerged,
  onContextMenu,
}: {
  session: SessionWithMember | undefined;
  goldenBellMemberIds: Set<number>;
  onEdit: (session: SessionWithMember) => void;
  onCreate: () => void;
  /** 연속된 시간대를 하나로 합친 칸일 때, 그 안에 포함된 전체 항목(2개 이상). */
  mergedSessions?: SessionWithMember[];
  onEditMerged?: (sessions: SessionWithMember[]) => void;
  onContextMenu?: (e: React.MouseEvent, sessions: SessionWithMember[]) => void;
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
  const isMerged = !!mergedSessions && mergedSessions.length > 1;
  return (
    <button
      draggable
      onDragStart={(e) => {
        const ids = isMerged ? mergedSessions!.map((s) => s.id) : [session.id];
        e.dataTransfer.setData("text/plain", JSON.stringify({ ids }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => (isMerged ? onEditMerged?.(mergedSessions!) : onEdit(session))}
      onContextMenu={(e) => onContextMenu?.(e, isMerged ? mergedSessions! : [session])}
      style={{ WebkitTouchCallout: "none" }}
      className={[
        "w-full h-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:shadow-sm cursor-grab active:cursor-grabbing",
        entryStyle(session),
      ].join(" ")}
    >
      {isSimpleEntry(session) ? (
        <span className="font-medium block break-words leading-tight">
          {entryIcon(session)}
          {entryMainLabel(session)}
        </span>
      ) : (
        <>
          <span className="font-medium block break-words leading-tight">
            {entryIcon(session)}
            {session.member_name}
            {progressLabel(session) && (
              <span className="ml-1 font-normal opacity-70">{progressLabel(session)}</span>
            )}
            {isGoldenBellSession(session, goldenBellMemberIds) && (
              <span className="ml-1" title="재등록 골든타임 — 잔여 3회 이하">
                🔔
              </span>
            )}
          </span>
          {session.status !== "reserved" && (
            <span className="block text-[10px] opacity-70">{STATUS_LABEL[session.status]}</span>
          )}
          {session.memo && (
            <span className="block text-[10px] opacity-60 break-words leading-tight">
              {session.memo}
            </span>
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
  dutyRoster,
  dutyOverrides,
  coachWorkingHours,
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
  /** weekday(0=월~6=일) -> 당직 코치 기본값. dateKeys 배열의 인덱스와 같은 규칙. */
  dutyRoster: Record<number, { coachId: number; coachName: string }>;
  /** 날짜(YYYY-MM-DD) -> 그 날짜만의 당직 예외(이번 주만 변경 등). coachId가
      null이면 그 날짜는 당직자 없음을 명시적으로 나타낸다. */
  dutyOverrides: Record<string, { coachId: number | null; coachName: string | null }>;
  /** 코치별 근무시간(평일/토요일). 값이 없는 코치는 제한 없음으로 취급한다. */
  coachWorkingHours: Record<number, CoachWorkingHours>;
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
  const [mergedEditTarget, setMergedEditTarget] = useState<SessionWithMember[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sessions: SessionWithMember[];
  } | null>(null);
  const [dutyRosterState] = useState(dutyRoster);
  const [dutyOverridesState, setDutyOverridesState] = useState(dutyOverrides);
  const [dutyEditDate, setDutyEditDate] = useState<{ date: string; weekday: number } | null>(null);
  const [coachFilter, setCoachFilter] = useState<number | "all">("all");
  const allGridScrollRef = useRef<HTMLDivElement | null>(null);

  const effectiveCoaches = coaches.length > 0 ? coaches : [];

  /** 그 날짜의 당직자를 계산한다: 이번 주만의 예외(dutyOverridesState)가
      있으면 그걸 우선 쓰고, 없으면 요일 기본값(dutyRosterState)을 쓴다.
      예외가 coachId: null이면 "이 날짜는 당직자 없음"을 뜻한다. */
  function resolveDuty(date: string, weekday: number): { coachId: number | null; coachName: string | null } | null {
    if (date in dutyOverridesState) return dutyOverridesState[date];
    return dutyRosterState[weekday] ?? null;
  }

  /** 코치의 근무시간 설정 밖인지를 판단한다. 설정이 없는 코치는 항상 false(제한
      없음). 공휴일은 토요일과 같은 단축 운영이라 토요일 근무시간을 기준으로 본다. */
  function isOutsideWorkingHours(coachId: number, date: string, hour: number): boolean {
    const wh = coachWorkingHours[coachId];
    if (!wh) return false;
    const useSaturdayHours = dateKeys.indexOf(date) === 5 || !!holidayMap[date];
    return useSaturdayHours
      ? hour < wh.saturdayStart || hour >= wh.saturdayEnd
      : hour < wh.weekdayStart || hour >= wh.weekdayEnd;
  }

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
  /** 날짜(YYYY-MM-DD) -> 그날이 생일인 재직 코치 이름들. 연도는 무시하고 월·일만 비교한다. */
  function birthdayCoachNamesFor(dateKey: string): string[] {
    const monthDay = dateKey.slice(5);
    return effectiveCoaches.filter((c) => c.birthday && c.birthday.slice(5) === monthDay).map((c) => c.name);
  }

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

  /** 개인 일정·수업 불가처럼 여러 시간을 한 번에 등록한 항목은 시간마다 별도
      행으로 저장되지만, 내용이 같은 채로 연속된 시간대라면 스케줄표에서 하나의
      칸으로 이어 붙여 보여준다(값은 followerCells에서 null 처리, leader만 표시). */
  const spanInfoMap = useMemo(() => {
    const map = new Map<string, { span: number; isFollower: boolean; sessions: SessionWithMember[] }>();
    for (const d of dateKeys) {
      const dh = dayHours[d];
      if (!dh || dh.closed) continue;
      for (const coach of coaches) {
        let hour = dh.start;
        while (hour < dh.end) {
          const key = `${d}-${coach.id}-${hour}`;
          const session = sessionMap.get(key);
          if (!session || !isSimpleEntry(session)) {
            hour += 1;
            continue;
          }
          let runEnd = hour + 1;
          const runSessions = [session];
          while (runEnd < dh.end) {
            const next = sessionMap.get(`${d}-${coach.id}-${runEnd}`);
            if (
              next &&
              next.entry_type === session.entry_type &&
              next.status === session.status &&
              (next.memo || "") === (session.memo || "")
            ) {
              runSessions.push(next);
              runEnd += 1;
            } else {
              break;
            }
          }
          const span = runEnd - hour;
          for (let h = hour; h < runEnd; h++) {
            map.set(`${d}-${coach.id}-${h}`, { span, isFollower: h !== hour, sessions: runSessions });
          }
          hour = runEnd;
        }
      }
    }
    return map;
  }, [dateKeys, dayHours, coaches, sessionMap]);

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

  /** 일정 칸을 오른쪽 클릭(또는 길게 눌러)하면 종류별 자주 쓰는 동작만 모은
      빠른 메뉴를 띄운다. PT 수업은 노쇼/취소/삭제, 개인 일정은 완료 처리/삭제,
      수업 불가는 삭제만 — 상담처럼 여기서 다루지 않는 종류는 기본 동작(브라우저
      메뉴)을 그대로 둔다. */
  function openQuickMenu(e: React.MouseEvent, sessionsForMenu: SessionWithMember[]) {
    const first = sessionsForMenu[0];
    if (first.entry_type !== "session" && first.entry_type !== "memo" && first.entry_type !== "blocked") {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessions: sessionsForMenu });
  }

  async function quickPatch(sessionsForMenu: SessionWithMember[], body: Record<string, unknown>) {
    setContextMenu(null);
    await Promise.all(
      sessionsForMenu.map((s) =>
        fetch(`/api/admin/sessions/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    );
    await refreshSessions();
  }

  async function quickDelete(sessionsForMenu: SessionWithMember[]) {
    setContextMenu(null);
    const confirmMessage =
      sessionsForMenu.length > 1 ? "이 시간대 전체를 완전히 삭제할까요?" : "이 일정을 완전히 삭제할까요?";
    if (!confirm(confirmMessage)) return;
    await Promise.all(sessionsForMenu.map((s) => fetch(`/api/admin/sessions/${s.id}`, { method: "DELETE" })));
    await refreshSessions();
  }

  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);

  /** 일정 pill을 드래그해서 다른 시간/코치 칸에 놓으면 그 칸으로 이동시킨다.
      개인 일정·수업 불가처럼 여러 시간이 하나로 합쳐진 칸이면, 안에 포함된
      모든 항목을 리더와의 시간차를 유지한 채 한꺼번에 옮긴다. */
  async function handleDropOnCell(
    e: React.DragEvent,
    targetDate: string,
    targetHour: number,
    targetCoachId: number,
  ) {
    e.preventDefault();
    let ids: number[] = [];
    try {
      const parsed = JSON.parse(e.dataTransfer.getData("text/plain")) as { ids?: unknown };
      if (Array.isArray(parsed.ids)) {
        ids = parsed.ids.filter((n): n is number => Number.isInteger(n));
      }
    } catch {
      ids = [];
    }
    if (ids.length === 0) return;

    const draggedSessions = ids
      .map((id) => sessions.find((s) => s.id === id))
      .filter((s): s is SessionWithMember => !!s);
    if (draggedSessions.length === 0) return;

    const leaderHour = Math.min(...draggedSessions.map((s) => s.session_hour));
    const moves = draggedSessions.map((s) => ({
      id: s.id,
      newHour: targetHour + (s.session_hour - leaderHour),
    }));

    const noChange = draggedSessions.every(
      (s, i) =>
        s.session_date === targetDate &&
        s.coach_id === targetCoachId &&
        s.session_hour === moves[i].newHour,
    );
    if (noChange) return;

    const dh = dayHours[targetDate];
    if (moves.some((m) => !dh || dh.closed || m.newHour < dh.start || m.newHour >= dh.end)) {
      alert("영업 시간을 벗어난 시간이에요.");
      return;
    }

    const draggedIdSet = new Set(ids);
    for (const m of moves) {
      const existing = sessionMap.get(`${targetDate}-${targetCoachId}-${m.newHour}`);
      if (existing && !draggedIdSet.has(existing.id)) {
        alert("이미 일정이 있는 시간이에요.");
        return;
      }
    }

    setLoading(true);
    const results = await Promise.all(
      moves.map((m) =>
        fetch(`/api/admin/sessions/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: targetDate, hour: m.newHour, coachId: targetCoachId }),
        }),
      ),
    );
    const failed = results.find((r) => !r.ok);
    if (failed) {
      const data = await failed.json().catch(() => ({}));
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

  /** 연/월을 고르면 그 달 1일이 속한 주로 바로 이동한다(1일이 아니어도
      서버에서 mondayOfWeek로 그 주의 월요일을 계산해준다). */
  function goToYearMonth(year: number, month: number) {
    router.push(`/admin/schedule?week=${year}-${String(month).padStart(2, "0")}-01`);
  }

  /** 스케줄표에서 당직을 바꾸면 항상 "이번 주(이 날짜)만"의 예외로 저장한다
      (요일 반복 기본값은 설정 페이지에서만 바꾼다). coachId가 undefined면
      이 날짜의 예외를 지워 요일 기본값으로 되돌린다. */
  async function assignDutyOverride(date: string, coachId: number | null | undefined) {
    const coach = typeof coachId === "number" ? effectiveCoaches.find((c) => c.id === coachId) : null;
    setDutyOverridesState((prev) => {
      const next = { ...prev };
      if (coachId === undefined) delete next[date];
      else next[date] = { coachId, coachName: coach?.name ?? null };
      return next;
    });
    setDutyEditDate(null);
    await fetch("/api/admin/duty-override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        coachId === undefined ? { date, clear: true } : { date, coachId },
      ),
    });
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
          {(() => {
            const [wsYear, wsMonth] = weekStart.split("-").map(Number);
            const currentYear = Number(today.split("-")[0]);
            const YEAR_RANGE = 2;
            const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => currentYear - YEAR_RANGE + i);
            return (
              <span className="flex items-center gap-1">
                <select
                  value={wsYear}
                  onChange={(e) => goToYearMonth(Number(e.target.value), wsMonth)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  value={wsMonth}
                  onChange={(e) => goToYearMonth(wsYear, Number(e.target.value))}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </span>
            );
          })()}
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

      <MemoPad
        title="메모장"
        initialMemos={initialMemos}
        addUrl="/api/admin/schedule-memos"
        idToDeleteUrl={(id) => `/api/admin/schedule-memos/${id}`}
      />

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
                    {birthdayCoachNamesFor(d).length > 0 && (
                      <p className="text-[9px] text-gold-deep truncate">
                        🎂 {birthdayCoachNamesFor(d).join(", ")} 생일
                      </p>
                    )}
                    {(() => {
                      const resolved = resolveDuty(d, i);
                      const label =
                        resolved === null
                          ? "당직 지정"
                          : resolved.coachId === null
                            ? "당직 없음"
                            : `당직 ${resolved.coachName}`;
                      return (
                        <button
                          type="button"
                          onClick={() => setDutyEditDate({ date: d, weekday: i })}
                          className={[
                            "text-[9px] truncate block w-full hover:underline",
                            resolved ? "text-coral/80" : "text-ink/30",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })()}
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
                    const outsideWorkingHours =
                      withinHours && isOutsideWorkingHours(singleCoach.id, d, hour);
                    const key = `${d}-${singleCoach.id}-${hour}`;
                    const session = sessionMap.get(key);
                    const spanInfo = spanInfoMap.get(key);
                    if (spanInfo?.isFollower) return null;
                    return (
                      <div
                        key={d}
                        className={[
                          "border-b border-line/40 p-1",
                          outsideWorkingHours ? "bg-line/25" : "",
                        ].join(" ")}
                        style={spanInfo && spanInfo.span > 1 ? { gridRow: `span ${spanInfo.span}` } : undefined}
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
                            mergedSessions={spanInfo?.sessions}
                            onEditMerged={setMergedEditTarget}
                            onContextMenu={openQuickMenu}
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
                    {birthdayCoachNamesFor(d).length > 0 && (
                      <p className="text-[9px] text-gold-deep truncate">
                        🎂 {birthdayCoachNamesFor(d).join(", ")} 생일
                      </p>
                    )}
                    {(() => {
                      const resolved = resolveDuty(d, i);
                      const label =
                        resolved === null
                          ? "당직 지정"
                          : resolved.coachId === null
                            ? "당직 없음"
                            : `당직 ${resolved.coachName}`;
                      return (
                        <button
                          type="button"
                          onClick={() => setDutyEditDate({ date: d, weekday: i })}
                          className={[
                            "text-[9px] truncate block w-full hover:underline",
                            resolved ? "text-coral/80" : "text-ink/30",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })()}
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
                      const outsideWorkingHours =
                        withinHours && isOutsideWorkingHours(coach.id, d, hour);
                      const key = `${d}-${coach.id}-${hour}`;
                      const session = withinHours ? sessionMap.get(key) : undefined;
                      const spanInfo = withinHours ? spanInfoMap.get(key) : undefined;
                      if (spanInfo?.isFollower) return null;
                      return (
                        <div
                          key={`${d}-${coach.id}`}
                          className={[
                            "border-b p-1",
                            ci === 0 ? "border-l-2 border-ink/25" : "border-l border-line/20",
                            outsideWorkingHours ? "bg-line/25" : "",
                          ].join(" ")}
                          style={spanInfo && spanInfo.span > 1 ? { gridRow: `span ${spanInfo.span}` } : undefined}
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
                              mergedSessions={spanInfo?.sessions}
                              onEditMerged={setMergedEditTarget}
                              onContextMenu={openQuickMenu}
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

      {mergedEditTarget && (
        <EditMergedBlockModal
          sessions={mergedEditTarget}
          onClose={() => setMergedEditTarget(null)}
          onChanged={async () => {
            setMergedEditTarget(null);
            setLoading(true);
            await refreshSessions();
            setLoading(false);
          }}
        />
      )}

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 min-w-[140px] overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-lg"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 160),
              top: Math.min(contextMenu.y, window.innerHeight - 160),
            }}
          >
            {contextMenu.sessions[0].entry_type === "session" && (
              <>
                <button
                  onClick={() => quickPatch(contextMenu.sessions, { status: "no_show" })}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bone transition"
                >
                  노쇼 처리
                </button>
                <button
                  onClick={() => quickPatch(contextMenu.sessions, { status: "cancelled" })}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bone transition"
                >
                  취소 처리
                </button>
                <button
                  onClick={() => quickDelete(contextMenu.sessions)}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-bone transition"
                >
                  기록 삭제
                </button>
              </>
            )}
            {contextMenu.sessions[0].entry_type === "memo" && (
              <>
                <button
                  onClick={() =>
                    quickPatch(contextMenu.sessions, {
                      status: contextMenu.sessions[0].status === "done" ? "reserved" : "done",
                    })
                  }
                  className="w-full px-4 py-2 text-left text-sm hover:bg-bone transition"
                >
                  {contextMenu.sessions[0].status === "done" ? "완료 취소" : "완료 처리"}
                </button>
                <button
                  onClick={() => quickDelete(contextMenu.sessions)}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-bone transition"
                >
                  삭제
                </button>
              </>
            )}
            {contextMenu.sessions[0].entry_type === "blocked" && (
              <button
                onClick={() => quickDelete(contextMenu.sessions)}
                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-bone transition"
              >
                삭제
              </button>
            )}
          </div>
        </>
      )}

      {dutyEditDate && (
        <DutyEditModal
          date={dutyEditDate.date}
          dateLabel={`${Number(dutyEditDate.date.split("-")[1])}/${Number(dutyEditDate.date.split("-")[2])}(${WEEKDAY_LABELS[dutyEditDate.weekday]})`}
          coaches={effectiveCoaches}
          resolved={resolveDuty(dutyEditDate.date, dutyEditDate.weekday)}
          hasOverride={dutyEditDate.date in dutyOverridesState}
          onClose={() => setDutyEditDate(null)}
          onAssign={assignDutyOverride}
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
  const [memberSessions, setMemberSessions] = useState<SessionWithMember[] | null>(null);

  // PT 수업 칸을 열면, 그 회원이 다른 날짜·시간에도 예약이 잡혀 있는지 바로
  // 보이도록 예약 내역을 함께 불러온다.
  useEffect(() => {
    if (session.entry_type !== "session" || session.member_id === null) return;
    let cancelled = false;
    fetch(`/api/admin/members/${session.member_id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setMemberSessions(data.sessions ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.entry_type, session.member_id]);

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

  async function handleDeleteOther(id: number, dateLabel: string) {
    if (!confirm(`${dateLabel} 예약을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMemberSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      onChanged();
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

          {session.entry_type === "memo" && (
            <button
              disabled={submitting}
              onClick={() => patch({ status: session.status === "done" ? "reserved" : "done" })}
              className="w-full rounded-full border border-line py-2.5 text-sm hover:bg-bone transition disabled:opacity-50"
            >
              {session.status === "done" ? "완료 취소" : "완료 처리"}
            </button>
          )}

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

        {session.entry_type === "session" && session.member_id !== null && (
          <div>
            <p className="text-sm font-medium mb-1.5">예약 내역</p>
            <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-line/50 px-2.5 py-2">
              {memberSessions === null ? (
                <p className="text-[11px] text-ink/40">불러오는 중...</p>
              ) : (
                (() => {
                  const todayKey = koreaTodayKey();
                  const others = memberSessions
                    .filter((s) => s.id !== session.id && s.session_date >= todayKey)
                    .sort(
                      (a, b) =>
                        a.session_date.localeCompare(b.session_date) || a.session_hour - b.session_hour,
                    );
                  if (others.length === 0) {
                    return <p className="text-[11px] text-ink/40">앞으로 예정된 다른 예약이 없어요.</p>;
                  }
                  return others.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-[11px] text-ink/60">
                      <span>
                        {s.session_date} {s.session_hour}:00
                      </span>
                      <span className="flex items-center gap-2">
                        {STATUS_LABEL[s.status]}
                        <button
                          type="button"
                          onClick={() => handleDeleteOther(s.id, `${s.session_date} ${s.session_hour}:00`)}
                          className="text-ink/40 hover:text-coral"
                        >
                          삭제
                        </button>
                      </span>
                    </div>
                  ));
                })()
              )}
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

        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={submitting}
            onClick={() => patch({ status: "no_show" })}
            className="rounded-full bg-red-400 text-white py-2 text-xs sm:text-sm font-medium hover:bg-red-500 transition disabled:opacity-50"
          >
            ✕ 노쇼 처리(차감)
          </button>
          <button
            disabled={submitting}
            onClick={() => patch({ status: "cancelled" })}
            className="rounded-full border border-line py-2 text-xs sm:text-sm hover:bg-bone transition disabled:opacity-50"
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
            className="rounded-full border border-line py-2 text-xs sm:text-sm hover:bg-bone transition disabled:opacity-50"
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

/** 스케줄표에서 하나로 이어 붙여 보여준 연속 시간대(개인 일정·수업 불가)를
    한 번에 수정·삭제하는 모달. 내부적으로는 여러 개의 시간별 행이지만, 이
    화면에서는 하나의 일정처럼 다룬다. */
function EditMergedBlockModal({
  sessions,
  onClose,
  onChanged,
}: {
  sessions: SessionWithMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const [memo, setMemo] = useState(first.memo);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const results = await Promise.all(
        sessions.map((s) =>
          fetch(`/api/admin/sessions/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memo }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) {
        setError("일부 시간대 저장에 실패했어요.");
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
    if (!confirm(`${first.session_hour}:00~${last.session_hour + 1}:00 전체를 삭제할까요?`)) return;
    setSubmitting(true);
    try {
      const results = await Promise.all(
        sessions.map((s) => fetch(`/api/admin/sessions/${s.id}`, { method: "DELETE" })),
      );
      if (results.every((r) => r.ok)) onChanged();
      else setError("일부 시간대 삭제에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleDone() {
    setSubmitting(true);
    setError(null);
    try {
      const nextStatus = first.status === "done" ? "reserved" : "done";
      const results = await Promise.all(
        sessions.map((s) =>
          fetch(`/api/admin/sessions/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) {
        setError("일부 시간대 처리에 실패했어요.");
        return;
      }
      onChanged();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={`${CATEGORY_LABELS[first.entry_type]} — ${first.session_date} ${first.session_hour}:00~${last.session_hour + 1}:00`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-xs text-ink/40">
          연속된 {sessions.length}개 시간대를 하나로 묶어 보여주고 있어요. 여기서 수정·삭제하면
          전체 시간대에 함께 적용돼요.
        </p>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {first.entry_type === "blocked" ? "사유" : "메모 내용"}
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
          onClick={handleSave}
          className="w-full rounded-full bg-ink text-white py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          저장
        </button>
        {first.entry_type === "memo" && (
          <button
            disabled={submitting}
            onClick={handleToggleDone}
            className="w-full rounded-full border border-line py-2.5 text-sm hover:bg-bone transition disabled:opacity-50"
          >
            {first.status === "done" ? "완료 취소" : "완료 처리"}
          </button>
        )}
        <button
          disabled={submitting}
          onClick={handleDelete}
          className="w-full text-sm text-red-500 hover:underline"
        >
          전체 시간대 삭제
        </button>
      </div>
    </ModalShell>
  );
}

/** 스케줄표 요일 헤더의 "당직 OOO" 표시를 눌렀을 때 뜨는, 그 날짜만의 당직자를
    바꾸는 모달. 여기서 바꾸는 값은 항상 "이번 주(이 날짜)만" 적용되는 예외이고,
    매주 반복되는 기본 담당자는 설정 페이지에서만 바꿀 수 있다. */
function DutyEditModal({
  date,
  dateLabel,
  coaches,
  resolved,
  hasOverride,
  onClose,
  onAssign,
}: {
  date: string;
  dateLabel: string;
  coaches: CoachRow[];
  resolved: { coachId: number | null; coachName: string | null } | null;
  hasOverride: boolean;
  onClose: () => void;
  onAssign: (date: string, coachId: number | null | undefined) => void;
}) {
  const currentCoachId = resolved?.coachId ?? null;
  return (
    <ModalShell title={`${dateLabel} 당직자`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-ink/50">
          여기서 바꾸면 이번 주({dateLabel})만 적용돼요. 매주 반복되는 기본
          담당자는 설정 페이지에서 바꿀 수 있어요.
        </p>
        <div className="space-y-2">
          {coaches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onAssign(date, c.id)}
              className={[
                "w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition",
                currentCoachId === c.id
                  ? "bg-ink text-white border-ink"
                  : "border-line hover:bg-bone",
              ].join(" ")}
            >
              {c.name}
            </button>
          ))}
          {coaches.length === 0 && (
            <p className="text-sm text-ink/40 py-2">재직 중인 코치가 없어요.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAssign(date, null)}
          className={[
            "w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition",
            resolved !== null && currentCoachId === null
              ? "bg-ink text-white border-ink"
              : "border-line hover:bg-bone",
          ].join(" ")}
        >
          이번 주는 당직 없음
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={() => onAssign(date, undefined)}
            className="w-full rounded-full border border-line py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
          >
            예외 취소하고 기본값으로 되돌리기
          </button>
        )}
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
