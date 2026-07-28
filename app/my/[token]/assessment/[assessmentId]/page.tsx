import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { getAssessmentById, getPainTriggerEntries } from "@/lib/assessments";
import { AssessmentDocument } from "@/app/components/AssessmentDocument";
import { PrintButton } from "@/app/components/PrintButton";

export default async function MyAssessmentDetailPage({
  params,
}: {
  params: Promise<{ token: string; assessmentId: string }>;
}) {
  const { token, assessmentId } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(assessmentIdNum)) {
    notFound();
  }
  const assessment = await getAssessmentById(assessmentIdNum);
  if (!assessment || assessment.member_id !== member.id) {
    notFound();
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <div className="flex items-center justify-between mb-6 no-print">
          <Link href={`/my/${token}/assessment`} className="text-sm text-ink/50 hover:text-ink">
            ← 평가 이력으로
          </Link>
          <PrintButton />
        </div>
        <AssessmentDocument
          memberName={member.name}
          assessment={{
            ...assessment,
            painTriggers: getPainTriggerEntries(assessment),
            exercisePerformance: assessment.exercise_performance,
          }}
        />
      </div>
    </main>
  );
}
