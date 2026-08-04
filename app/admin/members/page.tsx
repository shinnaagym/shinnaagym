import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { listCoaches, listFixedSlots, listMembersWithProgress } from "@/lib/schedule";
import { MembersView } from "./members-view";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; contract?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { open, contract } = await searchParams;
  const openId = open && /^\d+$/.test(open) ? Number(open) : null;
  const openContractView = contract === "1";

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
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Members</p>
      <h1 className="font-display text-2xl mb-1">회원 관리</h1>
      <p className="text-sm text-ink/50 mb-6">회원 목록을 조회하고 담당 코치·상태를 관리하세요.</p>
      <MembersView
        initialMembers={members}
        coaches={coaches}
        initialFixedSlots={fixedSlots}
        initialOpenId={openId}
        initialShowContractView={openContractView}
      />
    </div>
  );
}
