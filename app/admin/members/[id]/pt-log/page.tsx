import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember } from "@/lib/assessments";
import { PT_LOG_EQUIPMENT_LABELS } from "@/lib/constants";
import { AssessmentPainChart } from "../assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";
import { DeletePtLogButton } from "@/app/components/DeletePtLogButton";
import type { PtLogExercise } from "@/lib/db";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function exerciseSummary(e: PtLogExercise): string {
  const equipmentLabel = PT_LOG_EQUIPMENT_LABELS[e.equipment] ?? e.equipment;
  const groups =
    e.groups
      .map((g) => {
        const parts: string[] = [];
        if (g.weight != null) parts.push(`${g.weight}kg`);
        if (g.reps != null) parts.push(`${g.reps}회`);
        if (g.sets != null) parts.push(`${g.sets}set`);
        return parts.join(" ");
      })
      .filter((s) => s.length > 0)
      .join(", ") || "-";
  return `${e.name} (${equipmentLabel}) — ${groups}`;
}

export default async function PtLogHistoryPage({
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
  const [member, ptLogs, assessments] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">PT Log</p>
          <h1 className="font-display text-2xl">{member.name}님의 PT 일지</h1>
        </div>
      </div>

      <Link
        href={`/admin/members/${idNum}/pt-log/new`}
        className="block text-center rounded-full bg-coral text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition mb-6"
      >
        + 새 PT 일지 작성
      </Link>

      {/* 통증 척도·운동수행 능력 그래프는 평가 기록(평가지)과 같은 데이터를
          쓴다 — PT 일지에서 기록해도, 평가 기록 화면에서 기록해도 같은
          그래프에 반영된다. */}
      <AssessmentPainChart assessments={assessments} memberId={idNum} />
      <ExercisePerformanceChart assessments={assessments} memberId={idNum} />

      {ptLogs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 px-5 py-10 text-center text-ink/40">
          아직 작성된 PT 일지가 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {ptLogs.map((log) => (
            <li
              key={log.id}
              className="relative rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4 pr-16"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.log_date || formatDateTime(log.created_at)}</p>
                  {(log.pain_scale != null || log.memo) && (
                    <p className="text-xs text-ink/50 mt-0.5">
                      {log.pain_scale != null && `통증 ${log.pain_scale}/10`}
                      {log.pain_scale != null && log.memo && " · "}
                      {log.memo}
                    </p>
                  )}
                </div>
              </div>
              {log.exercises.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line/50 space-y-1 text-sm text-ink/70">
                  {log.exercises.map((e, i) => (
                    <p key={i}>{exerciseSummary(e)}</p>
                  ))}
                </div>
              )}
              <DeletePtLogButton
                ptLogId={log.id}
                className="absolute top-4 right-5 text-xs text-ink/40 hover:text-coral"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
