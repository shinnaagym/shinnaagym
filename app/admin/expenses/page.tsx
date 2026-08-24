import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey, koreaCurrentMonthKey } from "@/lib/date";
import { LedgerGated } from "./ledger-gated";

// 가계부는 저수지(세금·예비비) 데이터까지 포함한 민감한 재무 화면이라, 급여
// 계산과 마찬가지로 2차 비밀번호로 한 번 더 잠근다(app/admin/payroll와 동일한
// 패턴). 그래서 이 서버 컴포넌트는 지출/결제/저수지 데이터를 직접 조회하지
// 않는다 — 비밀번호를 확인하기 전에 데이터가 먼저 화면으로 내려가 버리면
// 잠금의 의미가 없으므로, 실제 조회는 잠금 해제 후 클라이언트에서
// isLedgerAuthed()로 보호되는 API를 통해 이뤄진다.
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { month } = await searchParams;
  const monthKey = month && isValidMonthKey(month) ? month : koreaCurrentMonthKey();

  return (
    <div className="mx-auto max-w-full px-4 py-6 sm:px-6 sm:py-8 md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Ledger</p>
      <h1 className="font-display text-2xl mb-1">가계부</h1>
      <p className="text-sm text-ink/50 mb-6">
        월별 지출 내역과 세금·예비비 저수지를 관리하세요.
      </p>
      <LedgerGated monthKey={monthKey} />
    </div>
  );
}
