import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_OPTIONS,
  NRS_PAIN_OPTIONS,
} from "./assessment-movements";
import {
  FAAM_ADL_ITEMS,
  FAAM_SPORTS_ITEMS,
  KOOS12_ITEMS,
  NDI_ITEMS,
  ODI_ITEMS,
  QUICKDASH_ITEMS,
  STARTBACK_ITEMS,
  type PromItem,
} from "./prom-instruments";
import type { AssessmentMovements, ExercisePerformanceEntry, PainTriggerEntry } from "./db";

const VALID_MOVEMENT_IDS = new Set(
  ASSESSMENT_REGIONS.flatMap((region) => region.movements.map((m) => m.id)),
);
const VALID_STRENGTH_VALUES = new Set<string>([...MMT_STRENGTH_OPTIONS, ""]);
const VALID_PAIN_SCALE_VALUES = new Set<string>([...NRS_PAIN_OPTIONS, ""]);
const VALID_FUNCTIONAL_TEST_KEYS = new Set(FUNCTIONAL_TESTS.map((t) => t.key));

export function parseMovements(raw: unknown): AssessmentMovements {
  const movements: AssessmentMovements = {};
  if (!raw || typeof raw !== "object") return movements;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_MOVEMENT_IDS.has(key) || !value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const romPassive = typeof entry.romPassive === "string" ? entry.romPassive.trim() : "";
    const romActive = typeof entry.romActive === "string" ? entry.romActive.trim() : "";
    const strength =
      typeof entry.strength === "string" && VALID_STRENGTH_VALUES.has(entry.strength)
        ? entry.strength
        : "";
    const painScale =
      typeof entry.painScale === "string" && VALID_PAIN_SCALE_VALUES.has(entry.painScale)
        ? entry.painScale
        : "";
    const compensation = typeof entry.compensation === "string" ? entry.compensation.trim() : "";
    if (!romPassive && !romActive && !strength && !painScale && !compensation) continue;
    movements[key] = { romPassive, romActive, strength, painScale, compensation };
  }
  return movements;
}

export function parsePainTriggers(raw: unknown): PainTriggerEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: PainTriggerEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const note = typeof record.note === "string" ? record.note.trim() : "";
    const painScale =
      typeof record.painScale === "number" &&
      Number.isInteger(record.painScale) &&
      record.painScale >= 0 &&
      record.painScale <= 10
        ? record.painScale
        : null;
    if (!note && painScale == null) continue;
    entries.push({ note, painScale });
  }
  return entries;
}

export function parseExercisePerformance(raw: unknown): ExercisePerformanceEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ExercisePerformanceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const exercise = typeof record.exercise === "string" ? record.exercise.trim() : "";
    const note = typeof record.note === "string" ? record.note.trim() : "";
    if (!exercise && !note) continue;
    entries.push({ exercise, note });
  }
  return entries;
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

export const parseOdiAnswers = (raw: unknown): Record<string, number> => parsePromAnswers(raw, ODI_ITEMS);
export const parseNdiAnswers = (raw: unknown): Record<string, number> => parsePromAnswers(raw, NDI_ITEMS);
export const parseQuickDashAnswers = (raw: unknown): Record<string, number> =>
  parsePromAnswers(raw, QUICKDASH_ITEMS);
export const parseKoos12Answers = (raw: unknown): Record<string, number> =>
  parsePromAnswers(raw, KOOS12_ITEMS);
export const parseFaamAdlAnswers = (raw: unknown): Record<string, number> =>
  parsePromAnswers(raw, FAAM_ADL_ITEMS);
export const parseFaamSportsAnswers = (raw: unknown): Record<string, number> =>
  parsePromAnswers(raw, FAAM_SPORTS_ITEMS);
export const parseStartbackAnswers = (raw: unknown): Record<string, number> =>
  parsePromAnswers(raw, STARTBACK_ITEMS);

/** 5개 기능적 움직임 검사(코어/스쿼트/오버헤드스쿼트/푸쉬업/힙힌지)의 "무통" 여부 맵. */
export function parseFunctionalTestPainFree(raw: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object") return result;
  const record = raw as Record<string, unknown>;
  for (const key of VALID_FUNCTIONAL_TEST_KEYS) {
    if (typeof record[key] === "boolean") {
      result[key] = record[key];
    }
  }
  return result;
}

/** LSI(좌우 대칭 지수, %) 값: 0~150 범위의 숫자만 허용(간헐적으로 100% 초과 가능). */
export function parseLsiValue(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 150 ? raw : null;
}

/** 무증상 점진 부하 유지 기간(주): 0~52 범위의 숫자만 허용. */
export function parseAsymptomaticLoadingWeeks(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 52 ? raw : null;
}

export interface ParsedAssessmentInput {
  evaluatorName: string;
  evaluatedAt: string;
  movements: AssessmentMovements;
  coreNote: string;
  squatNote: string;
  overheadSquatNote: string;
  pushupNote: string;
  hipHingeNote: string;
  painTriggers: PainTriggerEntry[];
  exercisePerformance: ExercisePerformanceEntry[];
  odiAnswers: Record<string, number>;
  ndiAnswers: Record<string, number>;
  quickdashAnswers: Record<string, number>;
  koos12Answers: Record<string, number>;
  faamAdlAnswers: Record<string, number>;
  faamSportsAnswers: Record<string, number>;
  functionalTestPainFree: Record<string, boolean>;
  hopTestLsi: number | null;
  cmjLsi: number | null;
  hamstringLsi: number | null;
  asymptomaticLoadingWeeks: number | null;
  startbackAnswers: Record<string, number>;
}

/** 평가지 작성/수정 API의 요청 본문을 공통으로 파싱한다(POST/PATCH에서 공유). */
export function parseAssessmentInput(body: Record<string, unknown> | null): ParsedAssessmentInput {
  return {
    evaluatorName: typeof body?.evaluatorName === "string" ? body.evaluatorName.trim() : "",
    evaluatedAt: typeof body?.evaluatedAt === "string" ? body.evaluatedAt.trim() : "",
    movements: parseMovements(body?.movements),
    coreNote: typeof body?.coreNote === "string" ? body.coreNote.trim() : "",
    squatNote: typeof body?.squatNote === "string" ? body.squatNote.trim() : "",
    overheadSquatNote: typeof body?.overheadSquatNote === "string" ? body.overheadSquatNote.trim() : "",
    pushupNote: typeof body?.pushupNote === "string" ? body.pushupNote.trim() : "",
    hipHingeNote: typeof body?.hipHingeNote === "string" ? body.hipHingeNote.trim() : "",
    painTriggers: parsePainTriggers(body?.painTriggers),
    exercisePerformance: parseExercisePerformance(body?.exercisePerformance),
    odiAnswers: parseOdiAnswers(body?.odiAnswers),
    ndiAnswers: parseNdiAnswers(body?.ndiAnswers),
    quickdashAnswers: parseQuickDashAnswers(body?.quickdashAnswers),
    koos12Answers: parseKoos12Answers(body?.koos12Answers),
    faamAdlAnswers: parseFaamAdlAnswers(body?.faamAdlAnswers),
    faamSportsAnswers: parseFaamSportsAnswers(body?.faamSportsAnswers),
    functionalTestPainFree: parseFunctionalTestPainFree(body?.functionalTestPainFree),
    hopTestLsi: parseLsiValue(body?.hopTestLsi),
    cmjLsi: parseLsiValue(body?.cmjLsi),
    hamstringLsi: parseLsiValue(body?.hamstringLsi),
    asymptomaticLoadingWeeks: parseAsymptomaticLoadingWeeks(body?.asymptomaticLoadingWeeks),
    startbackAnswers: parseStartbackAnswers(body?.startbackAnswers),
  };
}
