import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listAssessmentsByMember, getPainTriggerEntries } from "@/lib/assessments";
import { movementLabelWithRegion } from "@/lib/assessment-movements";
import { AssessmentPainChart } from "./pain-chart";
import { DeleteAssessmentButton } from "@/app/components/DeleteAssessmentButton";
import type { AssessmentRow } from "@/lib/db";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function flaggedMovementSummaries(assessment: AssessmentRow): string[] {
  return Object.entries(assessment.movements)
    .filter(
      ([, entry]) =>
        entry.compensation.trim().length > 0 || (entry.painScale && Number(entry.painScale) > 0),
    )
    .map(([movementId, entry]) => {
      const label = movementLabelWithRegion(movementId);
      const parts: string[] = [];
      if (entry.compensation) parts.push(entry.compensation);
      if (entry.painScale) parts.push(`통증 ${entry.painScale}/10`);
      return `${label} — ${parts.join(" · ")}`;
    });
}

export default async function AssessmentHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    notFound();
  }
  const member = await getMemberById(idNum);
  if (!member) {
    notFound();
  }

  const assessments = await listAssessmentsByMember(idNum);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Assessment</p>
          <h1 className="font-display text-2xl">{member.name}님의 체형 평가 이력</h1>
        </div>
        <Link
          href={`/admin/members/${idNum}/assessment/new`}
          className="rounded-full bg-coral text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition whitespace-nowrap"
        >
          + 새 평가 작성
        </Link>
      </div>

      {assessments.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 px-5 py-10 text-center text-ink/40">
          아직 작성된 평가가 없어요.
        </div>
      ) : (
        <>
        <AssessmentPainChart assessments={assessments} />
        <ul className="space-y-2">
          {assessments.map((a) => {
            const flagged = flaggedMovementSummaries(a);
            const painTriggers = getPainTriggerEntries(a);
            const maxPain = painTriggers.reduce<number | null>(
              (max, e) => (e.painScale != null && (max == null || e.painScale > max) ? e.painScale : max),
              null,
            );
            return (
              <li key={a.id} className="relative">
                <Link
                  href={`/admin/members/${idNum}/assessment/${a.id}`}
                  className="block rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4 pr-16 hover:border-coral/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {a.evaluated_at || formatDateTime(a.created_at)}
                      </p>
                      <p className="text-xs text-ink/50 mt-0.5">
                        담당 {a.evaluator_name || "-"}
                        {maxPain != null && ` · 최고 통증 ${maxPain}/10`}
                      </p>
                    </div>
                    <span className="text-ink/30">→</span>
                  </div>
                  {(flagged.length > 0 || painTriggers.length > 0) && (
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
                    </div>
                  )}
                </Link>
                <DeleteAssessmentButton
                  memberId={idNum}
                  assessmentId={a.id}
                  className="absolute top-4 right-5 text-xs text-ink/40 hover:text-coral"
                />
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}
