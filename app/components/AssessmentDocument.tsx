import {
  ASSESSMENT_REGIONS,
  FUNCTIONAL_TESTS,
  MMT_STRENGTH_LABELS,
} from "@/lib/assessment-movements";
import type { AssessmentMovements, ExercisePerformanceEntry, PainTriggerEntry } from "@/lib/db";

export interface AssessmentDocumentData {
  evaluator_name: string;
  evaluated_at: string;
  movements: AssessmentMovements;
  core_note: string;
  squat_note: string;
  overhead_squat_note: string;
  pushup_note: string;
  hip_hinge_note: string;
  painTriggers: PainTriggerEntry[];
  exercisePerformance: ExercisePerformanceEntry[];
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
      <p className="text-xs text-ink/50 mb-4">
        회원 {memberName} · 평가일 {assessment.evaluated_at || "-"} · 담당 트레이너{" "}
        {assessment.evaluator_name || "-"}
      </p>

      <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 text-xs text-ink/60 leading-relaxed mb-8">
        <p className="font-medium text-ink mb-1">민감정보 처리 안내</p>
        <p>
          이 평가지에는 건강상태, 병력, 통증 부위·통증 척도 등 「개인정보 보호법」상 민감정보가
          포함되어 있습니다. 해당 정보는 회원가입 계약서 제4조(민감정보 수집·이용 동의)에 따라
          별도 동의를 받은 정보이며, 오직 회원 맞춤형 운동 프로그램 설계 목적으로만 사용됩니다.
        </p>
      </div>

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
        {assessment.painTriggers.length === 0 ? (
          <div className="rounded-2xl border border-line px-4 py-4 text-sm text-ink/50">-</div>
        ) : (
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
            {assessment.painTriggers.map((entry, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <p>{entry.note || "-"}</p>
                <p className="font-display text-lg whitespace-nowrap">
                  {entry.painScale != null ? `${entry.painScale} / 10` : "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg mb-3">운동 수행능력 평가</h2>
        {assessment.exercisePerformance.length === 0 ? (
          <div className="rounded-2xl border border-line px-4 py-4 text-sm text-ink/50">-</div>
        ) : (
          <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
            {assessment.exercisePerformance.map((entry, i) => (
              <div key={i} className="px-4 py-3">
                <p className="font-medium text-ink">{entry.exercise || "-"}</p>
                <p className="text-ink/70">{entry.note || "-"}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1">
        <p>신나아짐 본점 T. 010-6859-6114</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-6859-6114)</p>
      </div>
    </>
  );
}
