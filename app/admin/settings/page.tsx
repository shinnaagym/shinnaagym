import { redirect } from "next/navigation";
import { getDeviceId, isAdminAuthed } from "@/lib/auth";
import {
  getActiveMemberCountsByCoach,
  getCoachWorkingHours,
  getDutyOverridesForMonth,
  listBlockedDaysForMonth,
  listCoachLeavesForMonth,
  listCoaches,
  listHolidays,
  listPromoPostsForMonth,
} from "@/lib/schedule";
import { koreaCurrentMonthKey } from "@/lib/date";
import { listRecurringEvents } from "@/lib/recurring-events";
import { listSettingsMemos } from "@/lib/settings-memos";
import { listNotices } from "@/lib/notices";
import { BUILD_ID } from "@/lib/build-info";
import { listActiveDevices } from "@/lib/devices";
import { SettingsView } from "./settings-view";

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const currentMonth = koreaCurrentMonthKey();

  const [
    coaches,
    holidays,
    memberCounts,
    devices,
    currentDeviceId,
    dutyOverrides,
    blockedDays,
    coachLeaves,
    promoPosts,
    recurringEvents,
    settingsMemos,
    coachWorkingHours,
    notices,
  ] = await Promise.all([
    listCoaches(),
    listHolidays(),
    getActiveMemberCountsByCoach(),
    listActiveDevices(),
    getDeviceId(),
    getDutyOverridesForMonth(currentMonth),
    listBlockedDaysForMonth(currentMonth),
    listCoachLeavesForMonth(currentMonth),
    listPromoPostsForMonth(currentMonth),
    listRecurringEvents(),
    listSettingsMemos(),
    getCoachWorkingHours(),
    listNotices(),
  ]);

  return (
    <div className="mx-auto max-w-full px-4 py-6 sm:px-6 sm:py-8 md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Settings</p>
      <h1 className="font-display text-2xl mb-1">설정</h1>
      <p className="text-sm text-ink/50 mb-6">코치·근무시간·당직 같은 운영 기본값을 관리하세요.</p>
      <SettingsView
        initialCoaches={coaches}
        initialHolidays={holidays}
        memberCounts={memberCounts}
        buildId={BUILD_ID}
        initialDevices={devices}
        currentDeviceId={currentDeviceId ?? null}
        initialDutyMonth={currentMonth}
        initialDutyOverrides={dutyOverrides}
        initialBlockedDays={blockedDays}
        initialCoachLeaves={coachLeaves}
        initialPromoPosts={promoPosts}
        initialRecurringEvents={recurringEvents}
        initialSettingsMemos={settingsMemos}
        initialCoachWorkingHours={coachWorkingHours}
        initialNotices={notices.filter((n) => n.category === "notice")}
        initialEvents={notices.filter((n) => n.category === "event")}
      />
    </div>
  );
}
