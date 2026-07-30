import { redirect } from "next/navigation";
import { getDeviceId, isAdminAuthed } from "@/lib/auth";
import { getActiveMemberCountsByCoach, listCoaches, listHolidays } from "@/lib/schedule";
import { BUILD_ID } from "@/lib/build-info";
import { listActiveDevices } from "@/lib/devices";
import { SettingsView } from "./settings-view";

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [coaches, holidays, memberCounts, devices, currentDeviceId] = await Promise.all([
    listCoaches(),
    listHolidays(),
    getActiveMemberCountsByCoach(),
    listActiveDevices(),
    getDeviceId(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <SettingsView
        initialCoaches={coaches}
        initialHolidays={holidays}
        memberCounts={memberCounts}
        buildId={BUILD_ID}
        initialDevices={devices}
        currentDeviceId={currentDeviceId ?? null}
      />
    </div>
  );
}
