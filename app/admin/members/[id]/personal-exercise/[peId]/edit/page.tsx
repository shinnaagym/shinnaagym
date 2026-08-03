import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { getPersonalExerciseById, listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { PtLogForm } from "../../../pt-log/pt-log-form";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
} from "../../../pt-log/past-exercise-names";

export default async function EditPersonalExercisePage({
  params,
}: {
  params: Promise<{ id: string; peId: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const { id, peId } = await params;
  const idNum = Number(id);
  const peIdNum = Number(peId);
  if (!Number.isInteger(idNum) || !Number.isInteger(peIdNum)) {
    notFound();
  }
  const [member, personalExercise, personalExercises] = await Promise.all([
    getMemberById(idNum),
    getPersonalExerciseById(peIdNum),
    listPersonalExercisesByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }
  if (!personalExercise || personalExercise.member_id !== idNum) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm
        memberId={idNum}
        memberName={member.name}
        ptLogId={peIdNum}
        kind="personal_exercise"
        pastExercises={pastExerciseNames(personalExercises, [])}
        pastExerciseGroups={pastExerciseGroups(personalExercises.filter((p) => p.id !== peIdNum))}
        pastCircuitEntries={pastCircuitEntries(personalExercises.filter((p) => p.id !== peIdNum))}
        initialData={{
          logDate: personalExercise.log_date,
          memo: personalExercise.memo,
          exercises: personalExercise.exercises.map((e) => ({
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
