import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { computeMemberProgress, getMemberById, hasSessionInRange } from "@/lib/schedule";
import { addDaysToKey, koreaTodayKey, mondayOfWeek } from "@/lib/date";
import { getPtLogById, listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, pastPainTriggerNotes } from "@/lib/assessments";
import { PtLogForm } from "../../pt-log-form";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
  pastExerciseNotes,
} from "../../past-exercise-names";

export default async function EditPtLogPage({
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
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
  // "다음주 수업 예약" 체크 표시용 날짜 범위 — 회원 목록 화면과 같은 기준.
  const thisWeekMonday = mondayOfWeek(koreaTodayKey());
  const nextWeekMonday = addDaysToKey(thisWeekMonday, 7);
  const nextWeekSunday = addDaysToKey(nextWeekMonday, 6);

  const [member, ptLog, ptLogs, assessments, hasNextWeekSession, progress] = await Promise.all([
    getMemberById(idNum),
    getPtLogById(logIdNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
    hasSessionInRange(idNum, nextWeekMonday, nextWeekSunday),
    computeMemberProgress(idNum),
  ]);
  if (!member) {
    notFound();
  }
  if (!ptLog || ptLog.member_id !== idNum) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm
        memberId={idNum}
        memberName={member.name}
        ptLogId={logIdNum}
        pastExercises={pastExerciseNames(ptLogs, assessments)}
        pastExerciseGroups={pastExerciseGroups(ptLogs.filter((l) => l.id !== logIdNum))}
        pastExerciseNotes={pastExerciseNotes(ptLogs.filter((l) => l.id !== logIdNum))}
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
  );
}
