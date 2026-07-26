import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { listCoaches, listMembersWithProgress } from "@/lib/schedule";
import { AdminNav } from "../admin-nav";
import { MembersView } from "./members-view";

export default async function AdminMembersPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [members, coaches] = await Promise.all([listMembersWithProgress(), listCoaches()]);

  return (
    <>
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <MembersView initialMembers={members} coaches={coaches} />
        </div>
      </main>
    </>
  );
}
