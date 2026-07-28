import {
  STANCE_LEG_OPTIONS,
  LEG_CROSS_OPTIONS,
  SLEEP_POSITION_OPTIONS,
  SLEEP_QUALITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  PAIN_ONSET_TYPE_OPTIONS,
  PAIN_CHARACTERISTIC_OPTIONS,
} from "./intake-questionnaire";

function optionValues(options: readonly { value: string }[]): Set<string> {
  return new Set<string>([...options.map((o) => o.value), ""]);
}

const VALID_STANCE_LEG = optionValues(STANCE_LEG_OPTIONS);
const VALID_LEG_CROSS = optionValues(LEG_CROSS_OPTIONS);
const VALID_SLEEP_POSITION = optionValues(SLEEP_POSITION_OPTIONS);
const VALID_SLEEP_QUALITY = optionValues(SLEEP_QUALITY_OPTIONS);
const VALID_STRESS_LEVEL = optionValues(STRESS_LEVEL_OPTIONS);
const VALID_PAIN_ONSET_TYPE = optionValues(PAIN_ONSET_TYPE_OPTIONS);
const VALID_PAIN_CYCLE_DIRECTION = new Set(["up", "down", ""]);
const VALID_CHARACTERISTIC_KEYS = new Set<string>(PAIN_CHARACTERISTIC_OPTIONS.map((o) => o.key));

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function strArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function enumVal(raw: unknown, valid: Set<string>): string {
  return typeof raw === "string" && valid.has(raw) ? raw : "";
}

function boolVal(raw: unknown): boolean {
  return raw === true;
}

function nrs(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : null;
}

function sleepHours(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 24 ? raw : null;
}

function characteristics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && VALID_CHARACTERISTIC_KEYS.has(v));
}

export interface ParsedIntakeInput {
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
  painTriggerMovements: string[];
  painNrsBest: number | null;
  painNrsWorst: number | null;
  painNrsCurrent: number | null;
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

export function parseIntakeInput(body: Record<string, unknown> | null): ParsedIntakeInput {
  return {
    stanceLeg: enumVal(body?.stanceLeg, VALID_STANCE_LEG),
    legCross: enumVal(body?.legCross, VALID_LEG_CROSS),
    sleepPosition: enumVal(body?.sleepPosition, VALID_SLEEP_POSITION),
    frequentMovement: str(body?.frequentMovement),
    sleepHours: sleepHours(body?.sleepHours),
    sleepQuality: enumVal(body?.sleepQuality, VALID_SLEEP_QUALITY),
    stressLevel: enumVal(body?.stressLevel, VALID_STRESS_LEVEL),
    drinking: boolVal(body?.drinking),
    smoking: boolVal(body?.smoking),
    otherNotes: str(body?.otherNotes),
    painOnsetPeriod: str(body?.painOnsetPeriod),
    painOnsetType: enumVal(body?.painOnsetType, VALID_PAIN_ONSET_TYPE),
    painMoi: str(body?.painMoi),
    painTriggerMovements: strArray(body?.painTriggerMovements),
    painNrsBest: nrs(body?.painNrsBest),
    painNrsWorst: nrs(body?.painNrsWorst),
    painNrsCurrent: nrs(body?.painNrsCurrent),
    painCycleSituation: str(body?.painCycleSituation),
    painCycleMorning: enumVal(body?.painCycleMorning, VALID_PAIN_CYCLE_DIRECTION),
    painCycleNoon: enumVal(body?.painCycleNoon, VALID_PAIN_CYCLE_DIRECTION),
    painCycleEvening: enumVal(body?.painCycleEvening, VALID_PAIN_CYCLE_DIRECTION),
    painCycleNight: enumVal(body?.painCycleNight, VALID_PAIN_CYCLE_DIRECTION),
    painCharacteristics: characteristics(body?.painCharacteristics),
    painCharacteristicsOther: str(body?.painCharacteristicsOther),
    improveFactors: str(body?.improveFactors),
    worsenFactors: str(body?.worsenFactors),
    perceivedCause: str(body?.perceivedCause),
    postPainAction: str(body?.postPainAction),
    pastSamePainHistory: str(body?.pastSamePainHistory),
    pastTreatment: str(body?.pastTreatment),
    majorComplaint: str(body?.majorComplaint),
    minorComplaint: str(body?.minorComplaint),
  };
}
