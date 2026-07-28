import type { PainMovementEntry } from "@/lib/db";

export interface IntakeFormState {
  intakeName: string;
  age: number | null;
  phone: string;
  visitChannel: string;
  visitChannelReferrerName: string;
  exercisePurposes: string[];
  exercisePurposeOther: string;
  stanceLeg: string;
  legCross: string;
  sleepPosition: string;
  frequentMovement: string;
  sleepHours: number | null;
  sleepQuality: string;
  stressLevel: string;
  drinking: boolean;
  smoking: boolean;
  otherNotes: string;
  painOnsetPeriod: string;
  painOnsetType: string;
  painMoi: string;
  painMovements: PainMovementEntry[];
  painCycleSituation: string;
  painCycleMorning: string;
  painCycleNoon: string;
  painCycleEvening: string;
  painCycleNight: string;
  painCharacteristics: string[];
  painCharacteristicsOther: string;
  improveFactors: string;
  worsenFactors: string;
  perceivedCause: string;
  postPainAction: string;
  pastSamePainHistory: string;
  pastTreatment: string;
  majorComplaint: string;
  minorComplaint: string;
}

export const EMPTY_PAIN_MOVEMENT: PainMovementEntry = {
  movement: "",
  nrsBest: null,
  nrsWorst: null,
  nrsCurrent: null,
};

export const EMPTY_INTAKE_FORM_STATE: IntakeFormState = {
  intakeName: "",
  age: null,
  phone: "",
  visitChannel: "",
  visitChannelReferrerName: "",
  exercisePurposes: [],
  exercisePurposeOther: "",
  stanceLeg: "",
  legCross: "",
  sleepPosition: "",
  frequentMovement: "",
  sleepHours: null,
  sleepQuality: "",
  stressLevel: "",
  drinking: false,
  smoking: false,
  otherNotes: "",
  painOnsetPeriod: "",
  painOnsetType: "",
  painMoi: "",
  painMovements: [{ ...EMPTY_PAIN_MOVEMENT }],
  painCycleSituation: "",
  painCycleMorning: "",
  painCycleNoon: "",
  painCycleEvening: "",
  painCycleNight: "",
  painCharacteristics: [],
  painCharacteristicsOther: "",
  improveFactors: "",
  worsenFactors: "",
  perceivedCause: "",
  postPainAction: "",
  pastSamePainHistory: "",
  pastTreatment: "",
  majorComplaint: "",
  minorComplaint: "",
};
