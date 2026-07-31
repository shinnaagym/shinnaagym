import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaCurrentMonthKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import {
  getAllCoachScheduleStats,
  getDayHoursForRange,
  getDutyOverridesForDates,
  getDutyRoster,
  listCoaches,
  listHolidays,
  listMembersWithProgress,
  listSessionsInRange,
} from "@/lib/schedule";
import { listScheduleMemos } from "@/lib/schedule-memos";
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

  const [coaches, members, sessions, dayHours, holidays, coachStats, memos, dutyRoster, dutyOverrides] =
    await Promise.all([
      listCoaches(),
      listMembersWithProgress(),
      listSessionsInRange(weekStart, weekEnd),
      getDayHoursForRange(dateKeys),
      listHolidays(),
      getAllCoachScheduleStats(monthKey, weekStart, weekEnd),
      listScheduleMemos(),
      getDutyRoster(),
      getDutyOverridesForDates(dateKeys),
    ]);

  const holidayMap = Object.fromEntries(
    holidays
      .filter((h) => dateKeys.includes(h.holiday_date))
      .map((h) => [h.holiday_date, h.name]),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
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
        dutyRoster={dutyRoster}
        dutyOverrides={dutyOverrides}
      />
    </div>
  );
}
