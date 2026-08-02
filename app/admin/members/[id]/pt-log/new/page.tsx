import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember } from "@/lib/assessments";
import { PtLogForm } from "../pt-log-form";
import { pastExerciseGroups, pastExerciseNames } from "../past-exercise-names";

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
  const [member, ptLogs, assessments] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm
        memberId={idNum}
        memberName={member.name}
        pastExercises={pastExerciseNames(ptLogs, assessments)}
        pastExerciseGroups={pastExerciseGroups(ptLogs)}
      />
    </div>
  );
}
