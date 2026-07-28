import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { getAssessmentById, getPainTriggerEntries } from "@/lib/assessments";
import { AssessmentDocument } from "@/app/components/AssessmentDocument";
import { PrintButton } from "@/app/components/PrintButton";
import { DeleteAssessmentButton } from "@/app/components/DeleteAssessmentButton";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    notFound();
  }
  const member = await getMemberById(idNum);
  if (!member) {
    notFound();
  }
  const assessment = await getAssessmentById(assessmentIdNum);
  if (!assessment || assessment.member_id !== idNum) {
    notFound();
  }
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href={`/admin/members/${idNum}/assessment`} className="text-sm text-ink/50 hover:text-ink">
          ← 평가 이력으로
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/members/${idNum}/assessment/${assessmentIdNum}/edit`}
            className="text-sm text-ink/50 hover:text-ink"
          >
            수정
          </Link>
          <DeleteAssessmentButton
            memberId={idNum}
            assessmentId={assessmentIdNum}
            redirectTo={`/admin/members/${idNum}/assessment`}
          />
          <PrintButton />
        </div>
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
  );
}
