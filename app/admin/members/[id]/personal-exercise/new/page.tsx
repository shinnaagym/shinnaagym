import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { PtLogForm } from "../../pt-log/pt-log-form";
import { pastCircuitEntries, pastExerciseGroups, pastExerciseNames } from "../../pt-log/past-exercise-names";

export default async function NewPersonalExercisePage({
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
  const [member, personalExercises] = await Promise.all([
    getMemberById(idNum),
    listPersonalExercisesByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }
  const duoPartner = member.duo_partner_id != null ? await getMemberById(member.duo_partner_id) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PtLogForm
        memberId={idNum}
        memberName={member.name}
        kind="personal_exercise"
        pastExercises={pastExerciseNames(personalExercises, [])}
        pastExerciseGroups={pastExerciseGroups(personalExercises)}
        pastCircuitEntries={pastCircuitEntries(personalExercises)}
        duoPartner={duoPartner ? { id: duoPartner.id, name: duoPartner.name } : null}
      />
    </div>
  );
}
