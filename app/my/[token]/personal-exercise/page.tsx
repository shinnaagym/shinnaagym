import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { PtLogList } from "@/app/admin/members/[id]/pt-log/pt-log-list";

export default async function MyPersonalExercisePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const personalExercises = await listPersonalExercisesByMember(member.id);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Personal Exercise</p>
        <h1 className="font-display text-3xl mb-6">{member.name}님의 개인 운동</h1>

        <Link
          href={`/my/${token}/personal-exercise/new`}
          className="block text-center rounded-full bg-coral text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition mb-6"
        >
          + 새 개인 운동 작성
        </Link>

        <div className="mb-8">
          <PtLogList
            ptLogs={personalExercises}
            emptyLabel="아직 기록된 개인 운동이 없어요."
            showDone
            editHrefBase={`/my/${token}/personal-exercise`}
            deleteEndpointBase={`/api/my/${token}/personal-exercises`}
            deleteConfirmMessage="이 개인 운동 기록을 삭제할까요? 되돌릴 수 없어요."
          />
        </div>

        <Link href={`/my/${token}`} className="block text-center text-sm text-ink/50 hover:text-ink mt-6">
          ← 내 예약으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
