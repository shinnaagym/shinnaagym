import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_LABELS,
} from "@/lib/assessment-movements";
import type { AssessmentMovements } from "@/lib/db";

export interface AssessmentDocumentData {
  evaluator_name: string;
  evaluated_at: string;
  movements: AssessmentMovements;
  core_note: string;
  squat_note: string;
  overhead_squat_note: string;
  pushup_note: string;
  hip_hinge_note: string;
  pain_trigger_note: string;
  pain_scale: number | null;
}

type NoteField =
  | "core_note"
  | "squat_note"
  | "overhead_squat_note"
  | "pushup_note"
  | "hip_hinge_note";

const FUNCTIONAL_NOTE_FIELDS: Record<string, NoteField> = {
  core: "core_note",
  squat: "squat_note",
  overheadSquat: "overhead_squat_note",
  pushup: "pushup_note",
  hipHinge: "hip_hinge_note",
};

// 회원 개인 계약서 페이지와 같은 결의 읽기 전용 렌더러 — 관리자의 평가 상세보기
// 페이지(과거 평가 이력 조회)에서 쓰인다. 55개 동작 전부를 부위별로 나열해
// 종이 평가지와 동일한 구조로 보여주고, 입력 없는 항목은 "-"로 표시한다.
export function AssessmentDocument({
  memberName,
  assessment,
}: {
  memberName: string;
  assessment: AssessmentDocumentData;
}) {
  return (
    <>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Assessment</p>
      <h1 className="font-display text-3xl mb-1">신체 평가지</h1>
      <p className="text-xs text-ink/50 mb-8">
        회원 {memberName} · 평가일 {assessment.evaluated_at || "-"} · 담당 트레이너{" "}
        {assessment.evaluator_name || "-"}
      </p>

      {ASSESSMENT_REGIONS.map((region) => (
        <section key={region.key} className="mb-8">
          <h2 className="font-display text-lg mb-3">{region.label}</h2>
          <div className="rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-bone/60 text-left text-ink/50">
                  <th className="px-3 py-2 font-medium">동작</th>
                  <th className="px-3 py-2 font-medium">가동범위(수동)</th>
                  <th className="px-3 py-2 font-medium">가동범위(능동)</th>
                  <th className="px-3 py-2 font-medium">근력</th>
                  <th className="px-3 py-2 font-medium">통증척도</th>
                  <th className="px-3 py-2 font-medium">보상패턴</th>
                </tr>
              </thead>
              <tbody>
                {region.movements.map((movement) => {
                  const entry = assessment.movements[movement.id];
                  return (
                    <tr key={movement.id} className="border-t border-line/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {movement.ko}
                        <span className="text-ink/40"> ({movement.en})</span>
                      </td>
                      <td className="px-3 py-2 text-ink/70">{entry?.romPassive || "-"}</td>
                      <td className="px-3 py-2 text-ink/70">{entry?.romActive || "-"}</td>
                      <td className="px-3 py-2 text-ink/70">
                        {entry?.strength ? MMT_STRENGTH_LABELS[entry.strength] ?? entry.strength : "-"}
                      </td>
                      <td className="px-3 py-2 text-ink/70">
                        {entry?.painScale ? `${entry.painScale} / 10` : "-"}
                      </td>
                      <td className="px-3 py-2 text-ink/70">{entry?.compensation || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">기능적 움직임 검사</h2>
        <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
          {FUNCTIONAL_TESTS.map((test) => (
            <div key={test.key} className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">{test.label}</p>
              <p>{assessment[FUNCTIONAL_NOTE_FIELDS[test.key]] || "-"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">통증 유발 동작</h2>
        <div className="rounded-2xl border border-line px-4 py-4 text-sm space-y-3">
          <div>
            <p className="text-xs text-ink/40 mb-0.5">회원마다 다른 동작(통증 나타나는 동작)</p>
            <p>{assessment.pain_trigger_note || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-ink/40 mb-0.5">통증 척도 (NRS 0~10)</p>
            <p className="font-display text-xl">
              {assessment.pain_scale != null ? `${assessment.pain_scale} / 10` : "-"}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
