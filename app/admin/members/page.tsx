import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { listCoaches, listFixedSlots, listMembersWithProgress } from "@/lib/schedule";
import { AdminNav } from "../admin-nav";
import { MembersView } from "./members-view";

export default async function AdminMembersPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const thisWeekMonday = mondayOfWeek(koreaTodayKey());
  const nextWeekMonday = addDaysToKey(thisWeekMonday, 7);
  const nextWeekSunday = addDaysToKey(nextWeekMonday, 6);

  const [members, coaches, fixedSlots] = await Promise.all([
    listMembersWithProgress(nextWeekMonday, nextWeekSunday),
    listCoaches(),
    listFixedSlots(),
  ]);

  return (
    <>
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <MembersView initialMembers={members} coaches={coaches} initialFixedSlots={fixedSlots} />
        </div>
      </main>
    </>
  );
}
