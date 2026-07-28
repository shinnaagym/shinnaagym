import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { listMembers } from "@/lib/schedule";
import { listIntakeMemberIds } from "@/lib/intake";
import { IntakeLanding } from "./intake-landing";

export default async function IntakeLandingPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const [members, intakeMemberIds] = await Promise.all([listMembers(), listIntakeMemberIds()]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Intake</p>
      <h1 className="font-display text-2xl mb-1">초진 문진표</h1>
      <p className="text-sm text-ink/50 mb-6">
        상담하러 온 분의 문진표를 먼저 작성하세요. 아직 정식 등록(패키지 결제)을 하지 않아도
        괜찮아요.
      </p>
      <IntakeLanding
        members={members.map((m) => ({ id: m.id, name: m.name, phone: m.phone }))}
        intakeMemberIds={[...intakeMemberIds]}
      />
    </div>
  );
}
