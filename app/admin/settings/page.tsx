import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getActiveMemberCountsByCoach, listCoaches, listHolidays } from "@/lib/schedule";
import { SettingsView } from "./settings-view";

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [coaches, holidays, memberCounts] = await Promise.all([
    listCoaches(),
    listHolidays(),
    getActiveMemberCountsByCoach(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <SettingsView
        initialCoaches={coaches}
        initialHolidays={holidays}
        memberCounts={memberCounts}
      />
    </div>
  );
}
