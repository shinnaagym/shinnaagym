import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
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

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">PT Log</p>
        <h1 className="font-display text-3xl mb-6">{member.name}님의 PT 일지</h1>

        <div className="mb-8">
          <PtLogList ptLogs={ptLogs} editable={false} />
        </div>

        <AssessmentPainChart assessments={assessments} />
        <ExercisePerformanceChart assessments={assessments} />

        <Link href={`/my/${token}`} className="block text-center text-sm text-ink/50 hover:text-ink mt-6">
          ← 내 예약으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
