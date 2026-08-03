import {
  PT_LOG_EQUIPMENT_OPTIONS,
  PT_LOG_CIRCUIT_TYPE_OPTIONS,
  PT_LOG_CIRCUIT_TYPE_LABELS,
} from "./constants";
import type { PtLogCircuit, PtLogExercise, PtLogSetGroup } from "./db";

const VALID_EQUIPMENT = new Set<string>(PT_LOG_EQUIPMENT_OPTIONS.map((o) => o.value));
const VALID_CIRCUIT_TYPES = new Set<string>(PT_LOG_CIRCUIT_TYPE_OPTIONS.map((o) => o.value));

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

/** 도구가 "서킷 트레이닝"일 때만 쓰는 AMRAP/TIMECAP/For Time/EMOM 기록을 검증한다.
    형식이 유효하지 않으면(알 수 없는 type 등) 그 운동 전체를 서킷 기록 없이 취급한다. */
function parseCircuit(raw: unknown): PtLogCircuit | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const type = typeof obj.type === "string" && VALID_CIRCUIT_TYPES.has(obj.type) ? obj.type : null;
  if (!type) return null;
  return {
    type,
    minutes: toNumberOrNull(obj.minutes),
    rounds: toNumberOrNull(obj.rounds),
    workout: typeof obj.workout === "string" ? obj.workout.trim() : "",
  };
}

export function parseExercises(raw: unknown): PtLogExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e): PtLogExercise => {
      const obj = (e ?? {}) as Record<string, unknown>;
      const equipment =
        typeof obj.equipment === "string" && VALID_EQUIPMENT.has(obj.equipment)
          ? obj.equipment
          : "bodyweight";
      const circuit = equipment === "circuit" ? parseCircuit(obj.circuit) : null;
      // 서킷 운동은 이름 입력칸 대신 형식(AMRAP 등)을 고르는 다이얼을 쓰므로,
      // 이름이 따로 안 넘어오면 형식 이름을 그대로 이름으로 쓴다.
      const rawName = typeof obj.name === "string" ? obj.name.trim() : "";
      const name = rawName || (circuit ? PT_LOG_CIRCUIT_TYPE_LABELS[circuit.type] ?? circuit.type : "");
      const note = typeof obj.note === "string" ? obj.note.trim() : "";
      return {
        name,
        equipment,
        groups: circuit ? [] : parseSetGroups(obj.groups),
        note,
        ...(circuit ? { circuit } : {}),
      };
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
