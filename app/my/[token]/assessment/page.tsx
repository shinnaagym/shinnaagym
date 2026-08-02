import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { listAssessmentsByMember, getPainTriggerEntries } from "@/lib/assessments";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { flaggedMovementSummaries } from "@/lib/assessment-movements";
import { AssessmentPainChart } from "@/app/admin/members/[id]/assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function MyAssessmentHistoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const [assessments, intake] = await Promise.all([
    listAssessmentsByMember(member.id),
    getIntakeQuestionnaireByMember(member.id),
  ]);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Assessment</p>
        <h1 className="font-display text-3xl mb-6">{member.name}님의 체형 평가 이력</h1>

        <Link
          href={`/my/${token}/intake`}
          className="flex items-center justify-between rounded-2xl border border-line bg-white/60 px-5 py-4 mb-6 hover:border-coral/40 transition"
        >
          <div>
            <p className="font-medium">📋 초진 문진표</p>
            <p className="text-xs text-ink/50 mt-0.5">
              {intake ? "확인하기" : "아직 작성되지 않았어요"}
            </p>
          </div>
          <span className="text-ink/30">→</span>
        </Link>

        {assessments.length === 0 ? (
          <div className="rounded-2xl bg-white border border-line/60 px-5 py-10 text-center text-ink/40">
            아직 작성된 평가가 없어요.
          </div>
        ) : (
          <>
            <AssessmentPainChart assessments={assessments} />
            <ExercisePerformanceChart assessments={assessments} />
            <ul className="space-y-2">
              {assessments.map((a) => {
                const flagged = flaggedMovementSummaries(a.movements);
                const painTriggers = getPainTriggerEntries(a);
                const exercisePerformance = a.exercise_performance;
                const maxPain = painTriggers.reduce<number | null>(
                  (max, e) =>
                    e.painScale != null && (max == null || e.painScale > max) ? e.painScale : max,
                  null,
                );
                return (
                  <li key={a.id}>
                    <Link
                      href={`/my/${token}/assessment/${a.id}`}
                      className="block rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4 hover:border-coral/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{a.evaluated_at || formatDateTime(a.created_at)}</p>
                          <p className="text-xs text-ink/50 mt-0.5">
                            담당 {a.evaluator_name || "-"}
                            {maxPain != null && ` · 최고 통증 ${maxPain}/10`}
                          </p>
                        </div>
                        <span className="text-ink/30">→</span>
                      </div>
                      {(flagged.length > 0 || painTriggers.length > 0 || exercisePerformance.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-line/50 space-y-1 text-sm text-ink/70">
                          {flagged.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                          {painTriggers.map((entry, i) => (
                            <p key={i}>
                              통증 유발 동작 — {entry.note || "-"}
                              {entry.painScale != null && ` · ${entry.painScale}/10`}
                            </p>
                          ))}
                          {exercisePerformance.map((entry, i) => (
                            <p key={i}>
                              운동 수행능력 — {entry.exercise || "-"}
                              {entry.note && ` · ${entry.note}`}
                            </p>
                          ))}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Link href={`/my/${token}`} className="block text-center text-sm text-ink/50 hover:text-ink mt-6">
          ← 내 예약으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
