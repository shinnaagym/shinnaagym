import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { getPtLogById, listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember } from "@/lib/assessments";
import { PtLogForm } from "../../pt-log-form";
import { pastExerciseGroups, pastExerciseNames } from "../../past-exercise-names";

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
  const [member, ptLog, ptLogs, assessments] = await Promise.all([
    getMemberById(idNum),
    getPtLogById(logIdNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
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
          })),
        }}
      />
    </div>
  );
}
