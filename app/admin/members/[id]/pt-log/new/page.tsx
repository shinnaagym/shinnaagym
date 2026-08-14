import { notFound, redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { getMemberById } from "@/lib/schedule";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listAssessmentsByMember, getPainTriggerEntries } from "@/lib/assessments";
import { PtLogForm } from "../pt-log-form";
import { pastCircuitEntries, pastExerciseGroups, pastExerciseNames } from "../past-exercise-names";

function pastPainTriggerNotes(assessments: Awaited<ReturnType<typeof listAssessmentsByMember>>): string[] {
  return Array.from(
    new Set(
      assessments
        .flatMap((a) => getPainTriggerEntries(a))
        .map((e) => e.note)
        .filter((note) => note.length > 0),
    ),
  );
}

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
  const [member, ptLogs, assessments] = await Promise.all([
    getMemberById(idNum),
    listPtLogsByMember(idNum),
    listAssessmentsByMember(idNum),
  ]);
  if (!member) {
    notFound();
  }
  const duoPartner = member.duo_partner_id != null ? await getMemberById(member.duo_partner_id) : null;
  const duoPartnerAssessments = duoPartner ? await listAssessmentsByMember(duoPartner.id) : [];

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
      />
    </div>
  );
}
