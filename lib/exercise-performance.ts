/**
 * 탑세트(그날 가장 무거웠던 세트)의 무게·횟수(·RPE)로 e1RM(추정 1RM)을 계산한다.
 * Epley 공식(weight × (1 + reps/30))을 사용 — 반복 횟수가 적을수록(대략 10회 이하)
 * 신뢰도가 높은 일반적인 강도 코칭용 근사치이며, 정밀한 1RM 측정을 대체하지 않는다.
 *
 * RPE(1~10)가 있으면 RIR(Reps In Reserve, 여유 횟수 = 10 − RPE)만큼 "한계까지
 * 했다면 몇 개를 했을지"로 횟수를 보정한 뒤(reps + RIR) 공식에 넣는다 — 같은
 * 무게·횟수라도 RPE가 낮을수록(여유가 많았을수록) 예상 1RM이 더 높게 나온다.
 * RPE가 없으면(과거 기록 등) 기존처럼 실제 수행 횟수를 한계치로 그대로 쓴다.
 */
export function computeE1rm(
  weight: number | null,
  reps: number | null,
  rpe?: number | null,
): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null;
  const validRpe = rpe != null && Number.isFinite(rpe) && rpe >= 1 && rpe <= 10 ? rpe : null;
  const effectiveReps = validRpe != null ? reps + (10 - validRpe) : reps;
  if (effectiveReps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + effectiveReps / 30) * 10) / 10;
}
