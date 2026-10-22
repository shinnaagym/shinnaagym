import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { listAssessmentsByMember, getPainTriggerEntries, pastPainTriggerNotes } from "@/lib/assessments";
import { flaggedMovementSummaries } from "@/lib/assessment-movements";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { listGoalMemosByMember } from "@/lib/goal-memos";
import { AssessmentPainChart } from "../assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";
import { InbodyChart } from "@/app/components/InbodyChart";
import { AssessmentSummaryCard, type AssessmentSummaryItem } from "@/app/components/AssessmentSummaryCard";
import { ImprovementDirectionNote } from "../assessment/improvement-direction-note";
import { ConsultationNote } from "../assessment/consultation-note";
import { PainTriggerSection } from "./pain-trigger-section";
import { ExercisePerformanceSection } from "./exercise-performance-section";
import { PtLogList } from "./pt-log-list";
import { MemoPad } from "../../../memo-pad";
import type { AssessmentRow } from "@/lib/db";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** assessment/page.tsx의 평가지 목록 요약과 같은 규칙(날짜·담당자·최고 통증·
    체크된 동작·통증 유발 동작·운동 수행능력)으로, AssessmentSummaryCard가
    그대로 받아 그릴 수 있는 형태로 정리한다. */
function buildAssessmentSummaryItems(assessments: AssessmentRow[]): AssessmentSummaryItem[] {
  return assessments.map((a) => {
    const painTriggers = getPainTriggerEntries(a);
    const maxPain = painTriggers.reduce<number | null>(
      (max, e) => (e.painScale != null && (max == null || e.painScale > max) ? e.painScale : max),
      null,
    );
    return {
      id: a.id,
      dateLabel: a.evaluated_at || formatDateTime(a.created_at),
      evaluatorName: a.evaluator_name,
      maxPain,
      flaggedLines: flaggedMovementSummaries(a.movements),
      painTriggerLines: painTriggers.map(
        (entry) => `통증 유발 동작 — ${entry.note || "-"}${entry.painScale != null ? ` · ${entry.painScale}/10` : ""}`,
      ),
      exercisePerformanceLines: a.exercise_performance.map(
        (entry) => `운동 수행능력 — ${entry.exercise || "-"}${entry.note ? ` · ${entry.note}` : ""}`,
      ),
    };
  });
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
  const [member, ptLogs, personalExercises, assessments, intake, goalMemos] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listPersonalExercisesByMember(idNum),
    listAssessmentsByMember(idNum),
    getIntakeQuestionnaireByMember(idNum),
    listGoalMemosByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }

  // 2:1 PT 짝이 있으면, 같은 페이지에서 두 회원의 PT 일지·그래프를 나란히 볼 수
  // 있게 짝 회원의 기록도 함께 불러온다(회원용 예약 페이지와 동일한 구성).
  // 짝 회원 조회와 그 기록 조회가 서로 의존하지 않는다 — duo_partner_id를
  // 이미 알고 있으니 getMemberById를 기다렸다가 그 결과로 나머지 3개를
  // 또 기다리는(왕복 2번) 대신, 4개를 한꺼번에 병렬로 날린다(왕복 1번).
  const duoPartnerId = member.duo_partner_id;
  const [duoPartner, duoPartnerPtLogs, duoPartnerAssessments, duoPartnerPersonalExercises] =
    duoPartnerId != null
      ? await Promise.all([
          getMemberById(duoPartnerId),
          listPtLogsByMember(duoPartnerId),
          listAssessmentsByMember(duoPartnerId),
          listPersonalExercisesByMember(duoPartnerId),
        ])
      : [null, [], [], []];

  const memberPastPainTriggerNotes = pastPainTriggerNotes(assessments);
  const pastExercises = Array.from(
    new Set(
      assessments
        .flatMap((a) => a.exercise_performance)
        .map((e) => e.exercise)
        .filter((exercise) => exercise.length > 0),
    ),
  );
  const duoPartnerPastPainTriggerNotes = pastPainTriggerNotes(duoPartnerAssessments);
  const duoPartnerPastExercises = Array.from(
    new Set(
      duoPartnerAssessments
        .flatMap((a) => a.exercise_performance)
        .map((e) => e.exercise)
        .filter((exercise) => exercise.length > 0),
    ),
  );

  const assessmentSummaryItems = buildAssessmentSummaryItems(assessments);
  const duoPartnerAssessmentSummaryItems = buildAssessmentSummaryItems(duoPartnerAssessments);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">PT Log</p>
          <h1 className="font-display text-2xl">
            {duoPartner ? `${member.name}/${duoPartner.name}` : member.name}님의 PT 일지
          </h1>
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

      {duoPartner && (
        <div className="mb-6">
          <h2 className="font-display text-lg mb-3">🤝 {duoPartner.name}님의 PT 일지</h2>
          <PtLogList ptLogs={duoPartnerPtLogs} />
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">🏃 개인 운동</h2>
        </div>
        <Link
          href={`/admin/members/${idNum}/personal-exercise/new`}
          className="block text-center rounded-full border border-coral text-coral px-4 py-2.5 text-sm font-medium hover:bg-coral/5 transition mb-4"
        >
          + 새 개인 운동 작성
        </Link>
        <PtLogList
          ptLogs={personalExercises}
          emptyLabel="아직 기록된 개인 운동이 없어요."
          showDone
          editHrefBase={`/admin/members/${idNum}/personal-exercise`}
          deleteEndpointBase="/api/admin/personal-exercises"
          deleteConfirmMessage="이 개인 운동 기록을 삭제할까요? 되돌릴 수 없어요."
        />

        {duoPartner && (
          <div className="mt-6">
            <h3 className="font-display text-base mb-3">🤝 {duoPartner.name}님의 개인 운동</h3>
            <PtLogList
              ptLogs={duoPartnerPersonalExercises}
              emptyLabel="아직 기록된 개인 운동이 없어요."
              showDone
              editHrefBase={`/admin/members/${duoPartner.id}/personal-exercise`}
              deleteEndpointBase="/api/admin/personal-exercises"
              deleteConfirmMessage="이 개인 운동 기록을 삭제할까요? 되돌릴 수 없어요."
            />
          </div>
        )}
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

      <div className="mb-6">
        <MemoPad
          title="목표"
          initialMemos={goalMemos}
          addUrl={`/api/admin/members/${idNum}/goal-memos`}
          itemUrlBase="/api/admin/goal-memos"
        />
      </div>

      <ImprovementDirectionNote memberId={idNum} initialValue={member.improvement_direction} />

      {/* 아직 이 화면에서 따로 저장한 적 없으면(consultation_note가 비어있으면),
          초진 문진표의 "상담 내용 · 서술"(pain_moi)을 그대로 가져와 처음 보여준다.
          한 번이라도 저장하면 그 뒤로는 독립된 값이라, 문진표를 나중에 고쳐도
          여기엔 자동으로 반영되지 않는다. */}
      <ConsultationNote
        memberId={idNum}
        initialValue={member.consultation_note || intake?.pain_moi || ""}
      />

      {/* 상담내용 바로 아래에, 그동안 작성한 평가지를 날짜별로 정리해 보여준다
          (기본은 접혀 있고 펼치면 각 평가지의 통증·동작 체크·운동 수행능력
          요약이 최신순으로 나온다). */}
      <AssessmentSummaryCard
        memberId={idNum}
        items={assessmentSummaryItems}
        title={duoPartner ? `📋 ${member.name}님 평가지 기록` : "📋 평가지 기록"}
      />
      {duoPartner && (
        <AssessmentSummaryCard
          memberId={duoPartner.id}
          items={duoPartnerAssessmentSummaryItems}
          title={`📋 ${duoPartner.name}님 평가지 기록`}
        />
      )}

      {/* 통증 척도·운동수행 능력 그래프는 평가 기록(평가지)과 같은 데이터를
          쓴다 — PT 일지에서 기록해도, 평가 기록 화면에서 기록해도 같은
          그래프에 반영된다. 그래프 자체 "+ 기록추가" 대신, 평가 기록 작성
          폼과 같은 입력 섹션을 그래프 바로 아래에 항상 띄워둔다. */}
      {duoPartner && <h2 className="font-display text-lg mb-3">📈 {member.name}님</h2>}
      <AssessmentPainChart assessments={assessments} />
      <PainTriggerSection memberId={idNum} pastNotes={memberPastPainTriggerNotes} />

      <ExercisePerformanceChart assessments={assessments} />
      <ExercisePerformanceSection memberId={idNum} pastExercises={pastExercises} />

      <InbodyChart ptLogs={ptLogs} memberId={idNum} />

      {duoPartner && (
        <>
          <h2 className="font-display text-lg mb-3">📈 {duoPartner.name}님</h2>
          <AssessmentPainChart assessments={duoPartnerAssessments} />
          <PainTriggerSection memberId={duoPartner.id} pastNotes={duoPartnerPastPainTriggerNotes} />

          <ExercisePerformanceChart assessments={duoPartnerAssessments} />
          <ExercisePerformanceSection memberId={duoPartner.id} pastExercises={duoPartnerPastExercises} />

          <InbodyChart ptLogs={duoPartnerPtLogs} memberId={duoPartner.id} />
        </>
      )}
    </div>
  );
}
