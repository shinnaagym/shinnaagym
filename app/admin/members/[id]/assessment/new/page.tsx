import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listAssessmentsByMember, pastPainTriggerNotes } from "@/lib/assessments";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { AssessmentForm } from "../assessment-form";

export default async function NewAssessmentPage({
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
  const [member, pastAssessments, ptLogs] = await Promise.all([
    getMemberById(idNum),
    listAssessmentsByMember(idNum),
    listPtLogsByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }
  const pastExercises = Array.from(
    new Set(
      pastAssessments
        .flatMap((a) => a.exercise_performance)
        .map((e) => e.exercise)
        .filter((exercise) => exercise.length > 0),
    ),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <AssessmentForm
        memberId={idNum}
        memberName={member.name}
        pastPainTriggerNotes={pastPainTriggerNotes(pastAssessments)}
        pastExercises={pastExercises}
        ptLogs={ptLogs}
      />
    </div>
  );
}
