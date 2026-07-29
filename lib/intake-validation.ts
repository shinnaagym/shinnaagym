import {
  STANCE_LEG_OPTIONS,
  LEG_CROSS_OPTIONS,
  SLEEP_POSITION_OPTIONS,
  SLEEP_QUALITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  PAIN_ONSET_TYPE_OPTIONS,
  PAIN_CHARACTERISTIC_OPTIONS,
  VISIT_CHANNEL_OPTIONS,
  EXERCISE_PURPOSE_OPTIONS,
} from "./intake-questionnaire";
import {
  ODI_ITEMS,
  NDI_ITEMS,
  QUICKDASH_ITEMS,
  KOOS12_ITEMS,
  FAAM_ADL_ITEMS,
  FAAM_SPORTS_ITEMS,
  STARTBACK_ITEMS,
  type PromItem,
} from "./prom-instruments";
import type { PainMovementEntry } from "./db";

function optionValues(options: readonly { value: string }[]): Set<string> {
  return new Set<string>([...options.map((o) => o.value), ""]);
}

const VALID_STANCE_LEG = optionValues(STANCE_LEG_OPTIONS);
const VALID_LEG_CROSS = optionValues(LEG_CROSS_OPTIONS);
const VALID_SLEEP_POSITION = optionValues(SLEEP_POSITION_OPTIONS);
const VALID_SLEEP_QUALITY = optionValues(SLEEP_QUALITY_OPTIONS);
const VALID_STRESS_LEVEL = optionValues(STRESS_LEVEL_OPTIONS);
const VALID_PAIN_ONSET_TYPE = optionValues(PAIN_ONSET_TYPE_OPTIONS);
const VALID_VISIT_CHANNEL = optionValues(VISIT_CHANNEL_OPTIONS);
const VALID_PAIN_CYCLE_DIRECTION = new Set(["up", "down", ""]);
const VALID_CHARACTERISTIC_KEYS = new Set<string>(PAIN_CHARACTERISTIC_OPTIONS.map((o) => o.key));
const VALID_EXERCISE_PURPOSE_KEYS = new Set<string>(EXERCISE_PURPOSE_OPTIONS.map((o) => o.key));

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function age(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 120 ? raw : null;
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

function exercisePurposes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && VALID_EXERCISE_PURPOSE_KEYS.has(v));
}

/** PROM 문항 답변 맵 공통 검증: 알려진 문항 key만, 해당 문항의 옵션 value 범위 내 숫자만 허용. */
function parsePromAnswers(raw: unknown, items: readonly PromItem[]): Record<string, number> {
  const answers: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return answers;
  const record = raw as Record<string, unknown>;
  for (const item of items) {
    const value = record[item.key];
    if (typeof value !== "number") continue;
    if (item.options.some((opt) => opt.value === value)) {
      answers[item.key] = value;
    }
  }
  return answers;
}

function painMovements(raw: unknown): PainMovementEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: PainMovementEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const movement = str(record.movement);
    const nrsBest = nrs(record.nrsBest);
    const nrsWorst = nrs(record.nrsWorst);
    const nrsCurrent = nrs(record.nrsCurrent);
    if (!movement && nrsBest == null && nrsWorst == null && nrsCurrent == null) continue;
    entries.push({ movement, nrsBest, nrsWorst, nrsCurrent });
  }
  return entries;
}

export interface ParsedIntakeInput {
  intakeName: string;
  age: number | null;
  phone: string;
  visitChannel: string;
  visitChannelReferrerName: string;
  visitChannelOther: string;
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
  odiAnswers: Record<string, number>;
  ndiAnswers: Record<string, number>;
  quickdashAnswers: Record<string, number>;
  koos12Answers: Record<string, number>;
  faamAdlAnswers: Record<string, number>;
  faamSportsAnswers: Record<string, number>;
  startbackAnswers: Record<string, number>;
}

export function parseIntakeInput(body: Record<string, unknown> | null): ParsedIntakeInput {
  return {
    intakeName: str(body?.intakeName),
    age: age(body?.age),
    phone: str(body?.phone),
    visitChannel: enumVal(body?.visitChannel, VALID_VISIT_CHANNEL),
    visitChannelReferrerName: str(body?.visitChannelReferrerName),
    visitChannelOther: str(body?.visitChannelOther),
    exercisePurposes: exercisePurposes(body?.exercisePurposes),
    exercisePurposeOther: str(body?.exercisePurposeOther),
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
    painMovements: painMovements(body?.painMovements),
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
    odiAnswers: parsePromAnswers(body?.odiAnswers, ODI_ITEMS),
    ndiAnswers: parsePromAnswers(body?.ndiAnswers, NDI_ITEMS),
    quickdashAnswers: parsePromAnswers(body?.quickdashAnswers, QUICKDASH_ITEMS),
    koos12Answers: parsePromAnswers(body?.koos12Answers, KOOS12_ITEMS),
    faamAdlAnswers: parsePromAnswers(body?.faamAdlAnswers, FAAM_ADL_ITEMS),
    faamSportsAnswers: parsePromAnswers(body?.faamSportsAnswers, FAAM_SPORTS_ITEMS),
    startbackAnswers: parsePromAnswers(body?.startbackAnswers, STARTBACK_ITEMS),
  };
}
