import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listAssessmentsByMember, getPainTriggerEntries } from "@/lib/assessments";
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
  const member = await getMemberById(idNum);
  if (!member) {
    notFound();
  }

  const pastAssessments = await listAssessmentsByMember(idNum);
  const pastPainTriggerNotes = Array.from(
    new Set(
      pastAssessments
        .flatMap((a) => getPainTriggerEntries(a))
        .map((e) => e.note)
        .filter((note) => note.length > 0),
    ),
  );
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
        pastPainTriggerNotes={pastPainTriggerNotes}
        pastExercises={pastExercises}
      />
    </div>
  );
}
