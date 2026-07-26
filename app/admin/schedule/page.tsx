import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import {
  getDayHoursForRange,
  listCoaches,
  listHolidays,
  listMembersWithProgress,
  listSessionsInRange,
} from "@/lib/schedule";
import { AdminNav } from "../admin-nav";
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
  const dateKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const weekEnd = dateKeys[6];

  const [coaches, members, sessions, dayHours, holidays] = await Promise.all([
    listCoaches(),
    listMembersWithProgress(),
    listSessionsInRange(weekStart, weekEnd),
    getDayHoursForRange(dateKeys),
    listHolidays(),
  ]);

  const holidayMap = Object.fromEntries(
    holidays
      .filter((h) => dateKeys.includes(h.holiday_date))
      .map((h) => [h.holiday_date, h.name]),
  );

  return (
    <>
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">
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
          />
        </div>
      </main>
    </>
  );
}
