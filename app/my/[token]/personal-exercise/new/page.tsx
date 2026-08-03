import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { PtLogForm } from "@/app/admin/members/[id]/pt-log/pt-log-form";
import {
  pastCircuitEntries,
  pastExerciseGroups,
  pastExerciseNames,
} from "@/app/admin/members/[id]/pt-log/past-exercise-names";

export default async function NewMyPersonalExercisePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const personalExercises = await listPersonalExercisesByMember(member.id);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <PtLogForm
          memberId={member.id}
          memberName={member.name}
          kind="personal_exercise"
          authToken={token}
          pastExercises={pastExerciseNames(personalExercises, [])}
          pastExerciseGroups={pastExerciseGroups(personalExercises)}
          pastCircuitEntries={pastCircuitEntries(personalExercises)}
        />
      </div>
    </main>
  );
}
