import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listAssessmentsByMember } from "@/lib/assessments";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
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
      <div className="flex items-center justify-between mb-6">
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
        <ul className="space-y-2">
          {assessments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/members/${idNum}/assessment/${a.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4 hover:border-coral/40 transition"
              >
                <div>
                  <p className="font-medium">
                    {a.evaluated_at || formatDateTime(a.created_at)}
                  </p>
                  <p className="text-xs text-ink/50 mt-0.5">
                    담당 {a.evaluator_name || "-"}
                    {a.pain_scale != null && ` · 통증 ${a.pain_scale}/10`}
                  </p>
                </div>
                <span className="text-ink/30">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
