import type { AssessmentRow, PtLogRow, PtLogSetGroup } from "@/lib/db";

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

export interface PastExerciseRecord {
  /** 그 운동에 마지막으로 썼던 운동 도구(맨몸/바벨/덤벨/케틀벨 등). */
  equipment: string;
  groups: PtLogSetGroup[];
}

/** 운동 이름 -> 가장 최근 PT 일지에서 그 운동을 기록했을 때의 도구·세트 그룹.
    ptLogs는 이미 최신순(log_date DESC)으로 정렬돼 있으므로, 이름마다 처음
    만나는 값이 곧 가장 최근 기록이다. 무게·횟수·세트 입력란에 회색 placeholder로
    "지난번엔 이렇게 했었다"를 보여주는 용도라 확정 값이 아니다. */
export function pastExerciseGroups(ptLogs: PtLogRow[]): Record<string, PastExerciseRecord> {
  const result: Record<string, PastExerciseRecord> = {};
  for (const log of ptLogs) {
    for (const exercise of log.exercises) {
      if (exercise.name && !(exercise.name in result) && exercise.groups.length > 0) {
        result[exercise.name] = { equipment: exercise.equipment, groups: exercise.groups };
      }
    }
  }
  return result;
}
