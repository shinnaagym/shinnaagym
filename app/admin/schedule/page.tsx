import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaCurrentMonthKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import {
  getAllCoachScheduleStats,
  getCoachLeavesForDates,
  getCoachWorkingHours,
  getDayHoursForRange,
  getDutyOverridesForDates,
  listCoaches,
  listHolidays,
  listMembersWithProgress,
  listSessionsInRange,
} from "@/lib/schedule";
import { listScheduleMemos } from "@/lib/schedule-memos";
import { ensureRecurringEventSessions } from "@/lib/recurring-events";
import { ScheduleGrid } from "./schedule-grid";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { week } = await searchParams;
  const today = koreaTodayKey();
  const weekStart = mondayOfWeek(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  // 스튜디오가 항상 휴무인 일요일은 스케줄표에서 완전히 제외 — 월~토 6일만 다룬다.
  const dateKeys = Array.from({ length: 6 }, (_, i) => addDaysToKey(weekStart, i));
  const weekEnd = dateKeys[dateKeys.length - 1];

  const monthKey = koreaCurrentMonthKey();

  // 스터디/독서 모임 같은 정기 일정의 이번 달·다음 달 발생분이 아직 스케줄표에
  // 없으면 미리 채워 넣는다 — 세션 목록을 읽기 전에 끝나야 그리드에 바로 보인다.
  await ensureRecurringEventSessions();

  const [
    coaches,
    members,
    sessions,
    dayHours,
    holidays,
    coachStats,
    memos,
    dutyOverrides,
    coachWorkingHours,
    coachLeaves,
  ] = await Promise.all([
    listCoaches(),
    listMembersWithProgress(),
    listSessionsInRange(weekStart, weekEnd),
    getDayHoursForRange(dateKeys),
    listHolidays(),
    getAllCoachScheduleStats(monthKey, weekStart, weekEnd),
    listScheduleMemos(),
    getDutyOverridesForDates(dateKeys),
    getCoachWorkingHours(),
    getCoachLeavesForDates(dateKeys),
  ]);

  const holidayMap = Object.fromEntries(
    holidays
      .filter((h) => dateKeys.includes(h.holiday_date))
      .map((h) => [h.holiday_date, h.name]),
  );

  return (
    <div className="mx-auto max-w-6xl 2xl:max-w-[1900px] px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Schedule</p>
      <h1 className="font-display text-2xl mb-1">스케줄</h1>
      <p className="text-sm text-ink/50 mb-6">주간 수업표를 확인하고 예약을 관리하세요.</p>
      <ScheduleGrid
        key={weekStart}
        weekStart={weekStart}
        dateKeys={dateKeys}
        today={today}
        coaches={coaches.filter((c) => c.active)}
        members={members.filter((m) => m.status === "active")}
        initialSessions={sessions}
        dayHours={dayHours}
        holidayMap={holidayMap}
        coachStats={Object.fromEntries(coachStats)}
        initialMemos={memos}
        dutyOverrides={dutyOverrides}
        coachWorkingHours={coachWorkingHours}
        coachLeaves={coachLeaves}
      />
    </div>
  );
}
