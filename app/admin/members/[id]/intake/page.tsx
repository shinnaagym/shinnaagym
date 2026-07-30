import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { IntakeForm } from "./intake-form";
import { EMPTY_INTAKE_FORM_STATE, type IntakeFormState } from "./intake-form-state";

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
  const [member, intake] = await Promise.all([
    getMemberById(idNum),
    getIntakeQuestionnaireByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }

  const initialData: IntakeFormState = intake
    ? {
        intakeName: intake.intake_name,
        age: intake.age,
        phone: intake.phone,
        visitChannel: intake.visit_channel,
        visitChannelReferrerName: intake.visit_channel_referrer_name,
        visitChannelOther: intake.visit_channel_other,
        exercisePurposes: intake.exercise_purposes,
        exercisePurposeOther: intake.exercise_purpose_other,
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
        bodyDiagramFront: intake.body_diagram_front,
        bodyDiagramBack: intake.body_diagram_back,
        painMovements:
          intake.pain_movements.length > 0
            ? intake.pain_movements
            : [{ movement: "", nrsBest: null, nrsWorst: null, nrsCurrent: null }],
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
        odiAnswers: intake.odi_answers,
        ndiAnswers: intake.ndi_answers,
        quickdashAnswers: intake.quickdash_answers,
        koos12Answers: intake.koos12_answers,
        faamAdlAnswers: intake.faam_adl_answers,
        faamSportsAnswers: intake.faam_sports_answers,
        startbackAnswers: intake.startback_answers,
      }
    : { ...EMPTY_INTAKE_FORM_STATE, intakeName: member.name, phone: member.phone };

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
