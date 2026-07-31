import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { listMembers } from "@/lib/schedule";
import { listAssessmentCountsByMember } from "@/lib/assessments";
import { AssessmentLanding } from "./assessment-landing";

export default async function AssessmentLandingPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [members, counts] = await Promise.all([listMembers(), listAssessmentCountsByMember()]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Assessment</p>
      <h1 className="font-display text-2xl mb-1">평가지</h1>
      <p className="text-sm text-ink/50 mb-6">
        상담하러 온 분의 신체 평가지를 먼저 작성하세요. 아직 정식 등록(패키지 결제)을 하지
        않아도 괜찮아요.
      </p>
      <AssessmentLanding
        members={members.map((m) => ({ id: m.id, name: m.name, phone: m.phone }))}
        assessmentCounts={[...counts.entries()]}
      />
    </div>
  );
}
