import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { IntakeForm, type IntakeFormState } from "./intake-form";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function IntakeQuestionnairePage({
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

  const intake = await getIntakeQuestionnaireByMember(idNum);
  const initialData: IntakeFormState | undefined = intake
    ? {
        stanceLeg: intake.stance_leg,
        legCross: intake.leg_cross,
        sleepPosition: intake.sleep_position,
        frequentMovement: intake.frequent_movement,
        sleepHours: intake.sleep_hours,
        sleepQuality: intake.sleep_quality,
        stressLevel: intake.stress_level,
        drinking: intake.drinking,
        smoking: intake.smoking,
        otherNotes: intake.other_notes,
        painOnsetPeriod: intake.pain_onset_period,
        painOnsetType: intake.pain_onset_type,
        painMoi: intake.pain_moi,
        painTriggerMovements:
          intake.pain_trigger_movements.length > 0 ? intake.pain_trigger_movements : [""],
        painNrsBest: intake.pain_nrs_best,
        painNrsWorst: intake.pain_nrs_worst,
        painNrsCurrent: intake.pain_nrs_current,
        painCycleSituation: intake.pain_cycle_situation,
        painCycleMorning: intake.pain_cycle_morning,
        painCycleNoon: intake.pain_cycle_noon,
        painCycleEvening: intake.pain_cycle_evening,
        painCycleNight: intake.pain_cycle_night,
        painCharacteristics: intake.pain_characteristics,
        painCharacteristicsOther: intake.pain_characteristics_other,
        improveFactors: intake.improve_factors,
        worsenFactors: intake.worsen_factors,
        perceivedCause: intake.perceived_cause,
        postPainAction: intake.post_pain_action,
        pastSamePainHistory: intake.past_same_pain_history,
        pastTreatment: intake.past_treatment,
        majorComplaint: intake.major_complaint,
        minorComplaint: intake.minor_complaint,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <IntakeForm
        memberId={idNum}
        memberName={member.name}
        initialData={initialData}
        updatedAt={intake ? formatDateTime(intake.updated_at) : undefined}
      />
    </div>
  );
}
