import { redirect } from "next/navigation";
import { getDeviceId, isAdminAuthed } from "@/lib/auth";
import {
  getActiveMemberCountsByCoach,
  getCoachWorkingHours,
  getDutyRoster,
  listCoaches,
  listHolidays,
} from "@/lib/schedule";
import { listRecurringEvents } from "@/lib/recurring-events";
import { listSettingsMemos } from "@/lib/settings-memos";
import { BUILD_ID } from "@/lib/build-info";
import { listActiveDevices } from "@/lib/devices";
import { SettingsView } from "./settings-view";

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [
    coaches,
    holidays,
    memberCounts,
    devices,
    currentDeviceId,
    dutyRoster,
    recurringEvents,
    settingsMemos,
    coachWorkingHours,
  ] = await Promise.all([
    listCoaches(),
    listHolidays(),
    getActiveMemberCountsByCoach(),
    listActiveDevices(),
    getDeviceId(),
    getDutyRoster(),
    listRecurringEvents(),
    listSettingsMemos(),
    getCoachWorkingHours(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Settings</p>
      <h1 className="font-display text-2xl mb-1">설정</h1>
      <p className="text-sm text-ink/50 mb-6">코치·근무시간·당직자 같은 운영 기본값을 관리하세요.</p>
      <SettingsView
        initialCoaches={coaches}
        initialHolidays={holidays}
        memberCounts={memberCounts}
        buildId={BUILD_ID}
        initialDevices={devices}
        currentDeviceId={currentDeviceId ?? null}
        initialDutyRoster={dutyRoster}
        initialRecurringEvents={recurringEvents}
        initialSettingsMemos={settingsMemos}
        initialCoachWorkingHours={coachWorkingHours}
      />
    </div>
  );
}
