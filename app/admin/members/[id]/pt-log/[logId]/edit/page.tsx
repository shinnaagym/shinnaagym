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
import { getPtLogById, listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, pastPainTriggerNotes } from "@/lib/assessments";
import { PtLogForm } from "../../pt-log-form";
import { ScheduleGrid } from "@/app/admin/schedule/schedule-grid";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
  pastExerciseNotes,
  pastExerciseNoteOptions,
  pastExerciseWeightOptions,
} from "../../past-exercise-names";

export default async function EditPtLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; logId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id, logId } = await params;
  const idNum = Number(id);
  const logIdNum = Number(logId);
  if (!Number.isInteger(idNum) || !Number.isInteger(logIdNum)) {
    notFound();
  }
  const { week } = await searchParams;
  const today = koreaTodayKey();
  // "다음주 수업 예약" 체크 표시용 날짜 범위 — 회원 목록 화면과 같은 기준.
  // 아래 코치 스케줄표에서 다른 주로 넘겨봐도 이 체크 기준은 "진짜 다음
  // 주"로 고정이다.
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
    ptLog,
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
    getPtLogById(logIdNum),
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
  if (!ptLog || ptLog.member_id !== idNum) {
    notFound();
  }

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
          ptLogId={logIdNum}
          pastExercises={pastExerciseNames(ptLogs, assessments)}
          pastExerciseGroups={pastExerciseGroups(ptLogs.filter((l) => l.id !== logIdNum))}
          pastExerciseNotes={pastExerciseNotes(ptLogs.filter((l) => l.id !== logIdNum))}
          pastExerciseWeightOptions={pastExerciseWeightOptions(ptLogs.filter((l) => l.id !== logIdNum))}
          pastExerciseNoteOptions={pastExerciseNoteOptions(ptLogs.filter((l) => l.id !== logIdNum))}
          pastCircuitEntries={pastCircuitEntries(ptLogs.filter((l) => l.id !== logIdNum))}
          painTriggerPastNotes={{ [idNum]: pastPainTriggerNotes(assessments) }}
          pastPtLogs={{ [idNum]: ptLogs.filter((l) => l.id !== logIdNum) }}
          assessments={{ [idNum]: assessments }}
          hasNextWeekSession={{ [idNum]: hasNextWeekSession }}
          memberProgress={{ [idNum]: progress }}
          initialData={{
            logDate: ptLog.log_date,
            memo: ptLog.memo,
            exercises: ptLog.exercises.map((e) => ({
              name: e.name,
              equipment: e.equipment,
              groups:
                e.groups.length > 0
                  ? e.groups.map((g) => ({
                      weight: g.weight == null ? "" : String(g.weight),
                      reps: g.reps == null ? "" : String(g.reps),
                      sets: g.sets == null ? "" : String(g.sets),
                      trackPerformance: false,
                      rpe: "",
                    }))
                  : [{ weight: "", reps: "", sets: "", trackPerformance: false, rpe: "" }],
              note: e.note ?? "",
              circuit: e.circuit
                ? {
                    type: e.circuit.type,
                    minutes: e.circuit.minutes == null ? "" : String(e.circuit.minutes),
                    rounds: e.circuit.rounds == null ? "" : String(e.circuit.rounds),
                    workout: e.circuit.workout ?? "",
                  }
                : null,
              done: e.done ?? false,
            })),
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
            basePath={`/admin/members/${idNum}/pt-log/${logIdNum}/edit`}
          />
        </div>
      )}
    </>
  );
}
