import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, getPainTriggerEntries } from "@/lib/assessments";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { AssessmentPainChart } from "../assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";
import { ImprovementDirectionNote } from "../assessment/improvement-direction-note";
import { PainTriggerSection } from "./pain-trigger-section";
import { ExercisePerformanceSection } from "./exercise-performance-section";
import { PtLogList } from "./pt-log-list";

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
  const [member, ptLogs, assessments, intake] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
    getIntakeQuestionnaireByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }

  const pastPainTriggerNotes = Array.from(
    new Set(
      assessments
        .flatMap((a) => getPainTriggerEntries(a))
        .map((e) => e.note)
        .filter((note) => note.length > 0),
    ),
  );
  const pastExercises = Array.from(
    new Set(
      assessments
        .flatMap((a) => a.exercise_performance)
        .map((e) => e.exercise)
        .filter((exercise) => exercise.length > 0),
    ),
  );

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

      <Link
        href={`/admin/members/${idNum}/assessment/new`}
        className="block text-center rounded-full bg-ink text-white px-4 py-2.5 text-sm font-medium hover:bg-coral transition mb-4"
      >
        + 새 평가 작성
      </Link>

      <div className="mb-4">
        <PtLogList ptLogs={ptLogs} />
      </div>

      <Link
        href={`/admin/members/${idNum}/intake`}
        className="flex items-center justify-between rounded-2xl border border-line bg-white/60 px-5 py-4 mb-4 hover:border-coral/40 transition"
      >
        <div>
          <p className="font-medium">📋 초진 문진표</p>
          <p className="text-xs text-ink/50 mt-0.5">
            {intake ? "작성 완료 · 내용 확인/수정" : "아직 작성되지 않았어요 · 작성하기"}
          </p>
        </div>
        <span className="text-ink/30">→</span>
      </Link>

      <ImprovementDirectionNote memberId={idNum} initialValue={member.improvement_direction} />

      {/* 통증 척도·운동수행 능력 그래프는 평가 기록(평가지)과 같은 데이터를
          쓴다 — PT 일지에서 기록해도, 평가 기록 화면에서 기록해도 같은
          그래프에 반영된다. 그래프 자체 "+ 기록추가" 대신, 평가 기록 작성
          폼과 같은 입력 섹션을 그래프 바로 아래에 항상 띄워둔다. */}
      <AssessmentPainChart assessments={assessments} />
      <PainTriggerSection memberId={idNum} pastNotes={pastPainTriggerNotes} />

      <ExercisePerformanceChart assessments={assessments} />
      <ExercisePerformanceSection memberId={idNum} pastExercises={pastExercises} />
    </div>
  );
}
