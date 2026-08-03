import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { getPersonalExerciseById, listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { PtLogForm } from "@/app/admin/members/[id]/pt-log/pt-log-form";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
} from "@/app/admin/members/[id]/pt-log/past-exercise-names";

export default async function EditMyPersonalExercisePage({
  params,
}: {
  params: Promise<{ token: string; peId: string }>;
}) {
  const { token, peId } = await params;
  const peIdNum = Number(peId);
  if (!Number.isInteger(peIdNum)) {
    notFound();
  }
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }
  const personalExercise = await getPersonalExerciseById(peIdNum);
  if (!personalExercise || personalExercise.member_id !== member.id) {
    notFound();
  }
  const personalExercises = await listPersonalExercisesByMember(member.id);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <PtLogForm
          memberId={member.id}
          memberName={member.name}
          ptLogId={peIdNum}
          kind="personal_exercise"
          authToken={token}
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
    </main>
  );
}
