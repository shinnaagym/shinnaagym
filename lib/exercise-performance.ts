/**
 * 탑세트(그날 가장 무거웠던 세트)의 무게·횟수로 e1RM(추정 1RM)을 계산한다.
 * Epley 공식(weight × (1 + reps/30))을 사용 — 반복 횟수가 적을수록(대략 10회 이하)
 * 신뢰도가 높은 일반적인 강도 코칭용 근사치이며, 정밀한 1RM 측정을 대체하지 않는다.
 */
export function computeE1rm(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
