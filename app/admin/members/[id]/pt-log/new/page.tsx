import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { PtLogForm } from "../pt-log-form";

export default async function NewPtLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    notFound();
  }
  const member = await getMemberById(idNum);
  if (!member) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm memberId={idNum} memberName={member.name} />
    </div>
  );
}
