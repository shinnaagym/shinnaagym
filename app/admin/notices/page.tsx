import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { listNotices } from "@/lib/notices";
import { NoticesView } from "./notices-view";

export default async function NoticesPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const notices = await listNotices();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Notice</p>
      <h1 className="font-display text-2xl mb-1">공지사항</h1>
      <p className="text-sm text-ink/50 mb-6">공지사항과 진행 중인 이벤트를 관리하세요.</p>
      <NoticesView
        initialNotices={notices.filter((n) => n.category === "notice")}
        initialEvents={notices.filter((n) => n.category === "event")}
      />
    </div>
  );
}
