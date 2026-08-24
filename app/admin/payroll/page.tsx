import { redirect } from "next/navigation";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { koreaCurrentMonthKey } from "@/lib/date";
import { listCoaches } from "@/lib/schedule";
import { PayrollGated } from "./payroll-gated";

export default async function PayrollPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  // 가계부 2차 비밀번호로 이미 인증되어 있으면(같은 비밀번호를 공유) 급여
  // 계산 비밀번호 화면을 건너뛴다.
  const initialUnlocked = await isPayrollAuthed();
  const coaches = await listCoaches(true);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1 no-print">Payroll</p>
      <h1 className="font-display text-2xl mb-1">급여 계산</h1>
      <p className="text-sm text-ink/50 mb-6 no-print">
        직원을 선택하고 정산월을 고르면 입사일과 진행 수업 횟수를 불러와요. 자동으로 불러온
        값은 오차 보정을 위해 직접 고쳐 쓸 수 있어요.
      </p>
      <PayrollGated
        coaches={coaches}
        defaultYearMonth={koreaCurrentMonthKey()}
        initialUnlocked={initialUnlocked}
      />
    </div>
  );
}
