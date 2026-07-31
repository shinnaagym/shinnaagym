import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { IntakeDocument } from "@/app/components/IntakeDocument";

export default async function MyIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const intake = await getIntakeQuestionnaireByMember(member.id);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        {intake ? (
          <IntakeDocument memberName={member.name} intake={intake} />
        ) : (
          <div className="rounded-2xl border border-line bg-white/60 px-6 py-10 text-center text-ink/50">
            아직 작성된 초진 문진표가 없어요.
          </div>
        )}
        <Link href={`/my/${token}`} className="block text-center text-sm text-ink/50 hover:text-ink mt-6">
          ← 내 예약으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
