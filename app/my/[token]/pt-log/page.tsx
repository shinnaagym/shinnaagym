import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberById, getMemberByToken } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember } from "@/lib/assessments";
import { AssessmentPainChart } from "@/app/admin/members/[id]/assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";
import { PtLogList } from "@/app/admin/members/[id]/pt-log/pt-log-list";

export default async function MyPtLogHistoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const [ptLogs, assessments] = await Promise.all([
    listPtLogsByMember(member.id),
    listAssessmentsByMember(member.id),
  ]);
  const duoPartner = member.duo_partner_id != null ? await getMemberById(member.duo_partner_id) : null;
  const [duoPartnerPtLogs, duoPartnerAssessments] = duoPartner
    ? await Promise.all([listPtLogsByMember(duoPartner.id), listAssessmentsByMember(duoPartner.id)])
    : [[], []];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">PT Log</p>
        <h1 className="font-serif-display text-3xl mb-2">{member.name}님의 PT 일지</h1>
        {duoPartner && (
          <p className="text-sm text-coral mb-6">🤝 {duoPartner.name}님과 2:1 PT를 함께 받고 있어요.</p>
        )}

        {duoPartner && <p className="text-sm font-medium text-ink/60 mb-2">{member.name}님</p>}
        <div className="mb-8">
          <PtLogList ptLogs={ptLogs} editable={false} />
        </div>

        <AssessmentPainChart assessments={assessments} />
        <ExercisePerformanceChart assessments={assessments} />

        {duoPartner && (
          <>
            <p className="text-sm font-medium text-ink/60 mb-2 mt-8">{duoPartner.name}님</p>
            <div className="mb-8">
              <PtLogList ptLogs={duoPartnerPtLogs} editable={false} />
            </div>
            <AssessmentPainChart assessments={duoPartnerAssessments} />
            <ExercisePerformanceChart assessments={duoPartnerAssessments} />
          </>
        )}

        <Link href={`/my/${token}`} className="block text-center text-sm text-ink/50 hover:text-ink mt-6">
          ← 내 예약으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
