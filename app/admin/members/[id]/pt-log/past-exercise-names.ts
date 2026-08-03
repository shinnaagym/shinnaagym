import type { AssessmentRow, PtLogCircuit, PtLogRow, PtLogSetGroup } from "@/lib/db";

/** 회원의 PT 일지·평가지에 그동안 기록된 운동 이름을 자동완성용으로 모은다. */
export function pastExerciseNames(ptLogs: PtLogRow[], assessments: AssessmentRow[]): string[] {
  const names = new Set<string>();
  for (const log of ptLogs) {
    for (const exercise of log.exercises) {
      if (exercise.name) names.add(exercise.name);
    }
  }
  for (const assessment of assessments) {
    for (const entry of assessment.exercise_performance) {
      if (entry.exercise) names.add(entry.exercise);
    }
  }
  return Array.from(names);
}

/** 같은 이름이라도 운동 도구가 다르면(예: 바벨 스쿼트 vs 덤벨 스쿼트) 다른 운동으로
    구분해야 하므로, 이름과 도구를 함께 묶어 조회 키로 쓴다. */
export function pastExerciseGroupKey(name: string, equipment: string): string {
  return `${equipment}::${name}`;
}

/** (운동 이름, 도구) -> 가장 최근 PT 일지에서 그 조합으로 기록했을 때의 세트 그룹.
    ptLogs는 이미 최신순(log_date DESC)으로 정렬돼 있으므로, 조합마다 처음
    만나는 값이 곧 가장 최근 기록이다. 무게·횟수·세트 입력란에 회색 placeholder로
    "지난번엔 이렇게 했었다"를 보여주는 용도라 확정 값이 아니다. */
export function pastExerciseGroups(ptLogs: PtLogRow[]): Record<string, PtLogSetGroup[]> {
  const result: Record<string, PtLogSetGroup[]> = {};
  for (const log of ptLogs) {
    for (const exercise of log.exercises) {
      if (!exercise.name || exercise.groups.length === 0) continue;
      const key = pastExerciseGroupKey(exercise.name, exercise.equipment);
      if (!(key in result)) result[key] = exercise.groups;
    }
  }
  return result;
}

export interface PastCircuitEntry {
  logDate: string;
  circuit: PtLogCircuit;
}

/** 형식(AMRAP/TIMECAP/For Time/EMOM)별로 과거 서킷 트레이닝 기록을 모은다.
    ptLogs가 이미 최신순으로 정렬돼 있으므로 그대로 최신순 목록이 된다.
    "과거 운동이력" 다이얼에서 형식에 맞는 지난 기록을 골라 그대로 불러오는 용도. */
export function pastCircuitEntries(ptLogs: PtLogRow[]): Record<string, PastCircuitEntry[]> {
  const result: Record<string, PastCircuitEntry[]> = {};
  for (const log of ptLogs) {
    for (const exercise of log.exercises) {
      if (exercise.equipment !== "circuit" || !exercise.circuit) continue;
      const type = exercise.circuit.type;
      if (!result[type]) result[type] = [];
      result[type].push({ logDate: log.log_date, circuit: exercise.circuit });
    }
  }
  return result;
}
