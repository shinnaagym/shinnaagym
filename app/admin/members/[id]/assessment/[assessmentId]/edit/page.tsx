import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import {
  getAssessmentById,
  getPainTriggerEntries,
  listAssessmentsByMember,
} from "@/lib/assessments";
import { AssessmentForm } from "../../assessment-form";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    notFound();
  }
  const [member, assessment, pastAssessments] = await Promise.all([
    getMemberById(idNum),
    getAssessmentById(assessmentIdNum),
    listAssessmentsByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }
  if (!assessment || assessment.member_id !== idNum) {
    notFound();
  }
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
        assessmentId={assessmentIdNum}
        initialData={{
          evaluatorName: assessment.evaluator_name,
          evaluatedAt: assessment.evaluated_at,
          movements: assessment.movements,
          coreNote: assessment.core_note,
          squatNote: assessment.squat_note,
          overheadSquatNote: assessment.overhead_squat_note,
          pushupNote: assessment.pushup_note,
          hipHingeNote: assessment.hip_hinge_note,
          painTriggers: getPainTriggerEntries(assessment),
          exercisePerformance: assessment.exercise_performance,
          odiAnswers: assessment.odi_answers,
          ndiAnswers: assessment.ndi_answers,
          quickdashAnswers: assessment.quickdash_answers,
          koos12Answers: assessment.koos12_answers,
          faamAdlAnswers: assessment.faam_adl_answers,
          faamSportsAnswers: assessment.faam_sports_answers,
          functionalTestPainFree: assessment.functional_test_pain_free,
          hopTestLsi: assessment.hop_test_lsi,
          cmjLsi: assessment.cmj_lsi,
          hamstringLsi: assessment.hamstring_lsi,
          asymptomaticLoadingWeeks: assessment.asymptomatic_loading_weeks,
          startbackAnswers: assessment.startback_answers,
        }}
      />
    </div>
  );
}
