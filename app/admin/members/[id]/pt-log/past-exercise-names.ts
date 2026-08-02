import type { AssessmentRow, PtLogRow } from "@/lib/db";

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
