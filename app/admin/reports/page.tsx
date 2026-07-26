import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { addMonthsToKey, isValidMonthKey, koreaCurrentMonthKey } from "@/lib/date";
import { getCoachMonthlyReports } from "@/lib/schedule";
import { AdminNav } from "../admin-nav";

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const { month } = await searchParams;
  const monthKey = month && isValidMonthKey(month) ? month : koreaCurrentMonthKey();
  const reports = await getCoachMonthlyReports(monthKey);
  const totalRevenue = reports.reduce((sum, r) => sum + r.revenue, 0);
  const totalCompleted = reports.reduce((sum, r) => sum + r.completedSessions, 0);

  return (
    <>
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/reports?month=${addMonthsToKey(monthKey, -1)}`}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
              >
                ‹ 이전 달
              </Link>
              <Link
                href="/admin/reports"
                className="rounded-full bg-ink text-white px-4 py-1.5 text-sm hover:bg-coral transition"
              >
                이번 달
              </Link>
              <Link
                href={`/admin/reports?month=${addMonthsToKey(monthKey, 1)}`}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-bone transition"
              >
                다음 달 ›
              </Link>
            </div>
            <p className="font-display text-lg">{formatMonthLabel(monthKey)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
              <p className="text-xs text-ink/50 mb-2">월 총 매출</p>
              <p className="text-2xl font-semibold text-gold">{formatWon(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
              <p className="text-xs text-ink/50 mb-2">전체 완료 세션</p>
              <p className="text-2xl font-semibold text-ink">{totalCompleted}</p>
            </div>
          </div>

          {/* 모바일: 카드 */}
          <div className="grid gap-3 sm:hidden">
            {reports.map((r) => (
              <div
                key={r.coachId}
                className="rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{r.coachName}</span>
                  <span className="text-gold font-semibold">{formatWon(r.revenue)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-ink/60">
                  <span>담당 {r.memberCount}명</span>
                  <span>완료 {r.completedSessions}회</span>
                  <span>
                    재등록율{" "}
                    {r.reRegistrationRate === null
                      ? "-"
                      : `${Math.round(r.reRegistrationRate * 100)}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-5 py-3 font-medium">코치</th>
                  <th className="px-5 py-3 font-medium">담당 회원</th>
                  <th className="px-5 py-3 font-medium">완료 세션</th>
                  <th className="px-5 py-3 font-medium">매출</th>
                  <th className="px-5 py-3 font-medium">재등록율</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.coachId} className="border-b border-line/40 last:border-0">
                    <td className="px-5 py-3 font-medium">{r.coachName}</td>
                    <td className="px-5 py-3 text-ink/70">{r.memberCount}명</td>
                    <td className="px-5 py-3 text-ink/70">{r.completedSessions}회</td>
                    <td className="px-5 py-3 text-gold font-medium">{formatWon(r.revenue)}</td>
                    <td className="px-5 py-3 text-ink/70">
                      {r.reRegistrationRate === null
                        ? "-"
                        : `${Math.round(r.reRegistrationRate * 100)}%`}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-ink/40">
                      코치가 없어요.
                    </td>
                  </tr>
                )}
              </tbody>
              {reports.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line/60 font-medium">
                    <td className="px-5 py-3">합계</td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-ink/70">{totalCompleted}회</td>
                    <td className="px-5 py-3 text-gold">{formatWon(totalRevenue)}</td>
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="text-xs text-ink/40 mt-4 leading-relaxed">
            매출은 그 달에 결제된 패키지 금액 합계, 재등록율은 (재등록 인원) ÷ (재등록 인원 +
            이탈 인원)으로 계산해요. 재등록 인원은 패키지를 2회 이상 결제한 회원, 이탈 인원은
            패키지를 1회만 결제하고 &apos;비활성&apos;으로 처리된 회원이에요. 회원 상태는
            회원 관리 화면에서 직접 변경할 수 있어요.
          </p>
        </div>
      </main>
    </>
  );
}
