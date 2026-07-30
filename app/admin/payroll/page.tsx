import { redirect } from "next/navigation";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { koreaCurrentMonthKey } from "@/lib/date";
import { listCoaches } from "@/lib/schedule";
import { PayrollGate } from "./payroll-gate";
import { PayrollView } from "./payroll-view";

export default async function PayrollPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  if (!(await isPayrollAuthed())) {
    return <PayrollGate />;
  }

  const coaches = await listCoaches(true);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1 no-print">Payroll</p>
      <h1 className="font-display text-2xl mb-1">급여 계산</h1>
      <p className="text-sm text-ink/50 mb-6 no-print">
        직원을 선택하고 정산월을 고르면 입사일과 진행 수업 횟수를 불러와요. 자동으로 불러온
        값은 오차 보정을 위해 직접 고쳐 쓸 수 있어요.
      </p>
      <PayrollView coaches={coaches} defaultYearMonth={koreaCurrentMonthKey()} />
    </div>
  );
}
