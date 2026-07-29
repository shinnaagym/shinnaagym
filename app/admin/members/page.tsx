import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { listCoaches, listFixedSlots, listMembersWithProgress } from "@/lib/schedule";
import { MembersView } from "./members-view";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { open } = await searchParams;
  const openId = open && /^\d+$/.test(open) ? Number(open) : null;

  const thisWeekMonday = mondayOfWeek(koreaTodayKey());
  const nextWeekMonday = addDaysToKey(thisWeekMonday, 7);
  const nextWeekSunday = addDaysToKey(nextWeekMonday, 6);

  const [members, coaches, fixedSlots] = await Promise.all([
    listMembersWithProgress(nextWeekMonday, nextWeekSunday),
    listCoaches(),
    listFixedSlots(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <MembersView
        initialMembers={members}
        coaches={coaches}
        initialFixedSlots={fixedSlots}
        initialOpenId={openId}
      />
    </div>
  );
}
