/**
 * 재활 단계에서 퍼포먼스(운동수행) 단계로 넘어가도 되는지 확인하는 표준 설문(PROM)
 * 전환 기준. 평가 기록(assessment-form)과 초진 문진표(intake-form)가 같은 기준을
 * 공유한다 — 초진 문진표는 선택한 부위에 해당하는 기준만 걸러서 보여준다.
 */

export interface Criterion {
  label: string;
  value: string;
  status: "pass" | "fail" | "unknown";
}

export function criterionIcon(status: Criterion["status"]): string {
  if (status === "pass") return "✅";
  if (status === "fail") return "⚠️";
  return "–";
}

export function odiCriterion(score: number | null): Criterion {
  return {
    label: "ODI(요추 기능장애) ≤ 20%",
    value: score == null ? "미입력" : `${score}%`,
    status: score == null ? "unknown" : score <= 20 ? "pass" : "fail",
  };
}

export function ndiCriterion(score: number | null): Criterion {
  return {
    label: "NDI(경추 기능장애) ≤ 15%",
    value: score == null ? "미입력" : `${score}%`,
    status: score == null ? "unknown" : score <= 15 ? "pass" : "fail",
  };
}

export function quickdashCriterion(score: number | null): Criterion {
  return {
    label: "QuickDASH(상지 기능장애) ≤ 15",
    value: score == null ? "미입력" : `${score}`,
    status: score == null ? "unknown" : score <= 15 ? "pass" : "fail",
  };
}

export function koos12Criterion(score: number | null): Criterion {
  return {
    label: "KOOS-12(무릎) ≥ 80",
    value: score == null ? "미입력" : `${score}`,
    status: score == null ? "unknown" : score >= 80 ? "pass" : "fail",
  };
}

export function faamAdlCriterion(score: number | null): Criterion {
  return {
    label: "FAAM ADL(발·발목 일상) ≥ 90%",
    value: score == null ? "미입력" : `${score}%`,
    status: score == null ? "unknown" : score >= 90 ? "pass" : "fail",
  };
}

export function faamSportsCriterion(score: number | null): Criterion {
  return {
    label: "FAAM 스포츠 ≥ 80%",
    value: score == null ? "미입력" : `${score}%`,
    status: score == null ? "unknown" : score >= 80 ? "pass" : "fail",
  };
}

export function startbackCriterion(score: { total: number; riskLabel: string } | null): Criterion {
  return {
    label: "STarT Back 총점 ≤ 3",
    value: score == null ? "미입력" : `${score.total}점`,
    status: score == null ? "unknown" : score.total <= 3 ? "pass" : "fail",
  };
}
