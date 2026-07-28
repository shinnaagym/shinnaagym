import { ASSESSMENT_REGIONS, MMT_STRENGTH_OPTIONS, NRS_PAIN_OPTIONS } from "./assessment-movements";
import type { AssessmentMovements, PainTriggerEntry } from "./db";

const VALID_MOVEMENT_IDS = new Set(
  ASSESSMENT_REGIONS.flatMap((region) => region.movements.map((m) => m.id)),
);
const VALID_STRENGTH_VALUES = new Set<string>([...MMT_STRENGTH_OPTIONS, ""]);
const VALID_PAIN_SCALE_VALUES = new Set<string>([...NRS_PAIN_OPTIONS, ""]);

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
