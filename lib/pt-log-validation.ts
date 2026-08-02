import { PT_LOG_EQUIPMENT_OPTIONS } from "./constants";
import type { PtLogExercise, PtLogSetGroup } from "./db";

const VALID_EQUIPMENT = new Set<string>(PT_LOG_EQUIPMENT_OPTIONS.map((o) => o.value));

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseSetGroups(raw: unknown): PtLogSetGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g): PtLogSetGroup => {
      const obj = (g ?? {}) as Record<string, unknown>;
      return {
        weight: toNumberOrNull(obj.weight),
        reps: toNumberOrNull(obj.reps),
        sets: toNumberOrNull(obj.sets),
      };
    })
    .filter((g) => g.weight != null || g.reps != null || g.sets != null);
}

export function parseExercises(raw: unknown): PtLogExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e): PtLogExercise => {
      const obj = (e ?? {}) as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const equipment =
        typeof obj.equipment === "string" && VALID_EQUIPMENT.has(obj.equipment)
          ? obj.equipment
          : "bodyweight";
      const note = typeof obj.note === "string" ? obj.note.trim() : "";
      return { name, equipment, groups: parseSetGroups(obj.groups), note };
    })
    .filter((e) => e.name.length > 0);
}

/** 0~10 범위로 자르고 반올림한다. 값이 없거나 유효하지 않으면 null(선택 안 함). */
export function parseScale(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n)));
}
