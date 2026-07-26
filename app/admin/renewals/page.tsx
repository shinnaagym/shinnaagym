import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { koreaCurrentMonthKey } from "@/lib/date";
import { listCoaches, listMembersWithProgress, listPackagePurchases } from "@/lib/schedule";
import { AdminNav } from "../admin-nav";
import { RenewalsView } from "./renewals-view";

export default async function AdminRenewalsPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const monthKey = koreaCurrentMonthKey();
  const [members, coaches, purchases] = await Promise.all([
    listMembersWithProgress(),
    listCoaches(),
    listPackagePurchases(monthKey),
  ]);
  const completedRenewals = purchases.filter((p) => !p.isFirst);

  return (
    <>
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <RenewalsView
            initialMembers={members}
            coaches={coaches}
            completedRenewals={completedRenewals}
          />
        </div>
      </main>
    </>
  );
}
