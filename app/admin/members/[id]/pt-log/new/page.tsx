import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import {
  computeMemberProgress,
  getAllCoachScheduleStats,
  getCoachLeavesForDates,
  getCoachWorkingHours,
  getDayHoursForRange,
  getDutyOverridesForDates,
  getMemberById,
  hasSessionInRange,
  listCoaches,
  listCoachSessionsInRange,
  listHolidays,
  listMembersWithProgress,
} from "@/lib/schedule";
import { getDailyScheduleMemos } from "@/lib/daily-schedule-memos";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, pastPainTriggerNotes } from "@/lib/assessments";
import { PtLogForm } from "../pt-log-form";
import { ScheduleGrid } from "@/app/admin/schedule/schedule-grid";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
  pastExerciseNotes,
  pastExerciseNoteOptions,
  pastExerciseWeightOptions,
} from "../past-exercise-names";

export default async function NewPtLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    notFound();
  }
  const { week } = await searchParams;
  const today = koreaTodayKey();
  // "다음주 수업 예약" 체크 표시용 날짜 범위 — 회원 목록 화면과 같은 기준
  // (이번주 월요일 + 7일 ~ 그 주 일요일). 아래 코치 스케줄표에서 다른 주로
  // 넘겨봐도 이 체크 기준은 "진짜 다음 주"로 고정이다.
  const thisWeekMonday = mondayOfWeek(today);
  const nextWeekMonday = addDaysToKey(thisWeekMonday, 7);
  const nextWeekSunday = addDaysToKey(nextWeekMonday, 6);
  // 코치 스케줄표가 보여줄 주 — 스케줄 화면과 똑같이 ?week= 쿼리로 다른 주를
  // 볼 수 있다(그리드의 "이전/다음 주" 버튼이 이 페이지 자신으로 이동시킨다).
  // 스튜디오가 항상 휴무인 일요일은 빼고 월~토 6일만 다룬다.
  const scheduleWeekStart = mondayOfWeek(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const dateKeys = Array.from({ length: 6 }, (_, i) => addDaysToKey(scheduleWeekStart, i));
  const weekEnd = dateKeys[dateKeys.length - 1];
  const monthKey = scheduleWeekStart.slice(0, 7);

  const [
    member,
    ptLogs,
    assessments,
    hasNextWeekSession,
    progress,
    coaches,
    activeMembers,
    dayHours,
    holidays,
    coachStats,
    dailyMemos,
    dutyOverrides,
    coachWorkingHours,
    coachLeaves,
  ] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
    hasSessionInRange(idNum, nextWeekMonday, nextWeekSunday),
    computeMemberProgress(idNum),
    listCoaches(),
    listMembersWithProgress(),
    getDayHoursForRange(dateKeys),
    listHolidays(),
    getAllCoachScheduleStats(monthKey, scheduleWeekStart, weekEnd),
    getDailyScheduleMemos(dateKeys),
    getDutyOverridesForDates(dateKeys),
    getCoachWorkingHours(),
    getCoachLeavesForDates(dateKeys),
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

  // PT 일지를 쓰면서 그 회원을 담당하는 코치의 이번 주 스케줄을, 스케줄
  // 화면과 똑같은(수정도 가능한) 그리드로 폼 맨 아래에 보여준다. 담당 코치가
  // 없으면(coach_id가 null) 아예 보여주지 않는다.
  const memberCoach = member.coach_id != null ? coaches.find((c) => c.id === member.coach_id) : null;
  const memberCoachSessions = memberCoach
    ? await listCoachSessionsInRange(memberCoach.id, scheduleWeekStart, weekEnd)
    : [];
  const activeMembersList = activeMembers.filter((m) => m.status === "active");

  return (
    <>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PtLogForm
          memberId={idNum}
          memberName={member.name}
          pastExercises={pastExerciseNames(ptLogs, assessments)}
          pastExerciseGroups={pastExerciseGroups(ptLogs)}
          pastExerciseNotes={pastExerciseNotes(ptLogs)}
          pastExerciseWeightOptions={pastExerciseWeightOptions(ptLogs)}
          pastExerciseNoteOptions={pastExerciseNoteOptions(ptLogs)}
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
      {memberCoach && (
        <div className="mx-auto max-w-4xl px-6 pb-8">
          <ScheduleGrid
            key={scheduleWeekStart}
            weekStart={scheduleWeekStart}
            dateKeys={dateKeys}
            today={today}
            coaches={[memberCoach]}
            members={activeMembersList}
            initialSessions={memberCoachSessions}
            dayHours={dayHours}
            holidayMap={Object.fromEntries(
              holidays.filter((h) => dateKeys.includes(h.holiday_date)).map((h) => [h.holiday_date, h.name]),
            )}
            coachStats={Object.fromEntries(coachStats)}
            initialDailyMemos={dailyMemos}
            dutyOverrides={dutyOverrides}
            coachWorkingHours={coachWorkingHours}
            coachLeaves={coachLeaves}
            initialCoachFilter={memberCoach.id}
            basePath={`/admin/members/${idNum}/pt-log/new`}
          />
        </div>
      )}
    </>
  );
}
