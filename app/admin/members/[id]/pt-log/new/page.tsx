import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { computeMemberProgress, getMemberById, hasSessionInRange } from "@/lib/schedule";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, pastPainTriggerNotes } from "@/lib/assessments";
import { PtLogForm } from "../pt-log-form";
import { pastCircuitEntries, pastExerciseGroups, pastExerciseNames } from "../past-exercise-names";

export default async function NewPtLogPage({
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
  // "다음주 수업 예약" 체크 표시용 날짜 범위 — 회원 목록 화면과 같은 기준
  // (이번주 월요일 + 7일 ~ 그 주 일요일).
  const thisWeekMonday = mondayOfWeek(koreaTodayKey());
  const nextWeekMonday = addDaysToKey(thisWeekMonday, 7);
  const nextWeekSunday = addDaysToKey(nextWeekMonday, 6);

  const [member, ptLogs, assessments, hasNextWeekSession, progress] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
    hasSessionInRange(idNum, nextWeekMonday, nextWeekSunday),
    computeMemberProgress(idNum),
  ]);
  if (!member) {
    notFound();
  }
  // 짝 회원 조회와 그 데이터 조회가 서로 의존하지 않아(duo_partner_id를 이미
  // 알고 있음), 한꺼번에 병렬로 날린다.
  const duoPartnerId = member.duo_partner_id;
  const [duoPartner, duoPartnerAssessments, duoPartnerPtLogs, duoPartnerHasNextWeekSession, duoPartnerProgress] =
    duoPartnerId != null
      ? await Promise.all([
          getMemberById(duoPartnerId),
          listAssessmentsByMember(duoPartnerId),
          listPtLogsByMember(duoPartnerId),
          hasSessionInRange(duoPartnerId, nextWeekMonday, nextWeekSunday),
          computeMemberProgress(duoPartnerId),
        ])
      : [null, [], [], false, null];

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm
        memberId={idNum}
        memberName={member.name}
        pastExercises={pastExerciseNames(ptLogs, assessments)}
        pastExerciseGroups={pastExerciseGroups(ptLogs)}
        pastCircuitEntries={pastCircuitEntries(ptLogs)}
        duoPartner={duoPartner ? { id: duoPartner.id, name: duoPartner.name } : null}
        painTriggerPastNotes={{
          [idNum]: pastPainTriggerNotes(assessments),
          ...(duoPartner ? { [duoPartner.id]: pastPainTriggerNotes(duoPartnerAssessments) } : {}),
        }}
        pastPtLogs={{
          [idNum]: ptLogs,
          ...(duoPartner ? { [duoPartner.id]: duoPartnerPtLogs } : {}),
        }}
        assessments={{
          [idNum]: assessments,
          ...(duoPartner ? { [duoPartner.id]: duoPartnerAssessments } : {}),
        }}
        hasNextWeekSession={{
          [idNum]: hasNextWeekSession,
          ...(duoPartner ? { [duoPartner.id]: duoPartnerHasNextWeekSession } : {}),
        }}
        memberProgress={{
          [idNum]: progress,
          ...(duoPartner && duoPartnerProgress ? { [duoPartner.id]: duoPartnerProgress } : {}),
        }}
      />
    </div>
  );
}
