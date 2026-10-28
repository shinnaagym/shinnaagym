import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { koreaCurrentMonthKey } from "@/lib/date";
import {
  getChurnedMembersForMonth,
  getCoachRetentionReports,
  getMonthlyRetentionStats,
  listCoaches,
  listMembersWithProgress,
} from "@/lib/schedule";
import { GoldenTimeTable } from "./golden-time-table";

const RETENTION_MONTHS = 6;

function formatMonthShort(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return `${Number(m)}월`;
}

function formatRate(rate: number | null): string {
  return rate === null ? "-" : `${Math.round(rate * 100)}%`;
}

export default async function AdminRetentionPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }

  const monthKey = koreaCurrentMonthKey();

  const [monthlyStats, coachReports, coaches, members, churnedThisMonth] = await Promise.all([
    getMonthlyRetentionStats(monthKey, RETENTION_MONTHS),
    getCoachRetentionReports(monthKey, RETENTION_MONTHS),
    listCoaches(),
    listMembersWithProgress(),
    getChurnedMembersForMonth(monthKey),
  ]);

  const coachNameMap = Object.fromEntries(coaches.map((c) => [c.id, c.name]));

  // 대상 여부·잔여는 실제 출석(done_count) 기준으로 판단한다 — 미래에 예약만
  // 해둔 수업까지 "다 썼다"고 치면, 아직 꽤 남은 회원이 "만료"로 보여 혼란을
  // 준다(실제로 PT가 그만큼 남아있는데 당장 재등록을 독촉해야 할 것처럼 보임).
  const goldenMembers = members
    .filter((m) => m.status === "active" && m.total_sessions > 0 && m.total_sessions - m.done_count <= 3)
    .sort((a, b) => a.total_sessions - a.done_count - (b.total_sessions - b.done_count));

  const currentMonthStats = monthlyStats[monthlyStats.length - 1];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Retention</p>
      <h1 className="font-display text-2xl mb-1">재등록 관리</h1>
      <p className="text-sm text-ink/50 mb-6">잔여 횟수가 얼마 안 남은 회원을 확인하고 재등록을 챙기세요.</p>

      {/* 이 페이지 전체가 보여주려는 단일 숫자(이번 달 재등록률)를 표 셀 속에
          묻어두지 않고 맨 위에 큼직하게 뽑아, 아래 표는 그 근거 데이터로
          읽히게 한다(대시보드의 "이번 달 총 매출" 헤드라인 카드와 같은 패턴). */}
      {currentMonthStats && (
        <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 mb-6">
          <p className="text-xs text-ink/50 mb-2">{formatMonthShort(monthKey)} 재등록률</p>
          <p className="text-2xl sm:text-3xl font-semibold text-gold-deep">
            {formatRate(currentMonthStats.reRegistrationRate)}
          </p>
          <p className="text-xs text-ink/40 mt-1.5">
            재등록 {currentMonthStats.reRegisteredCount}명 · 이탈 {currentMonthStats.churnedCount}명 · 신규
            등록 {currentMonthStats.newMemberCount}명
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <p className="font-display text-lg">재등록 통계</p>
          <p className="text-xs text-ink/40">
            최근 {RETENTION_MONTHS}개월 · 재등록률 = 재등록 ÷ (재등록+이탈)
          </p>
        </div>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                <th className="py-2 pr-4 font-medium">월</th>
                {monthlyStats.map((p) => (
                  <th key={p.month} className="py-2 px-3 font-medium text-center">
                    {formatMonthShort(p.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/40">
                <td className="py-2.5 pr-4 text-ink/60">신규 등록</td>
                {monthlyStats.map((p) => (
                  <td key={p.month} className="py-2.5 px-3 text-center font-medium">
                    {p.newMemberCount}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-line/40">
                <td className="py-2.5 pr-4 text-ink/60">재등록</td>
                {monthlyStats.map((p) => (
                  <td key={p.month} className="py-2.5 px-3 text-center font-medium">
                    {p.reRegisteredCount}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-line/40">
                <td className="py-2.5 pr-4 text-ink/60">이탈</td>
                {monthlyStats.map((p) => (
                  <td key={p.month} className="py-2.5 px-3 text-center font-medium text-ink/70">
                    {p.churnedCount}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-ink/60">재등록률</td>
                {monthlyStats.map((p) => (
                  <td key={p.month} className="py-2.5 px-3 text-center font-medium">
                    {formatRate(p.reRegistrationRate)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-bone/40 border border-line/60 px-4 py-3.5 mb-8">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="font-display text-lg">이번 달 이탈 회원</p>
            <p className="text-xs text-ink/40">{formatMonthShort(monthKey)} · {churnedThisMonth.length}명</p>
          </div>
          {churnedThisMonth.length === 0 ? (
            <p className="text-sm text-ink/40">이번 달 이탈 처리된 회원이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {churnedThisMonth.map((m) => (
                <li key={m.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-ink/50 text-xs">{m.coachName}</span>
                  {m.memo && <span className="text-ink/60 text-xs">— {m.memo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <p className="font-display text-lg">코치별 재등록률</p>
          <p className="text-xs text-ink/40">최근 {RETENTION_MONTHS}개월 합계</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                <th className="py-2 pr-4 font-medium">코치</th>
                <th className="py-2 px-3 font-medium text-center">이번 달 재등록</th>
                <th className="py-2 px-3 font-medium text-center">{RETENTION_MONTHS}개월 재등록</th>
                <th className="py-2 px-3 font-medium text-center">{RETENTION_MONTHS}개월 이탈</th>
                <th className="py-2 px-3 font-medium text-center">재등록률</th>
              </tr>
            </thead>
            <tbody>
              {coachReports.map((r) => (
                <tr key={r.coachId} className="border-b border-line/40 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{r.coachName}</td>
                  <td className="py-2.5 px-3 text-center">{r.monthReRegisteredCount}건</td>
                  <td className="py-2.5 px-3 text-center">{r.periodReRegisteredCount}건</td>
                  <td className="py-2.5 px-3 text-center text-ink/70">{r.periodChurnedCount}</td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {formatRate(r.reRegistrationRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-bone/50 border border-line/60 px-5 py-4 mb-6 text-sm text-ink/70 leading-relaxed">
        <span className="font-medium text-ink">재등록 플레이북</span> — 잔여 3회 도달 시 자동으로
        아래 골든타임 목록에 올라옵니다. ① 잔여 3회: 성과 리뷰 + 재등록 안내 → ② 잔여 1회: 결제
        확정 → ③ 만료 후 7일 내 미등록 시 이탈 처리·사유 기록.
      </div>

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <div className="flex items-baseline gap-2 mb-4">
          <p className="font-display text-lg">🔔 재등록 골든타임</p>
          <p className="text-xs text-ink/40">잔여 3회 이하 — 자동 추출</p>
        </div>
        <GoldenTimeTable
          members={goldenMembers.map((m) => ({
            id: m.id,
            name: m.name,
            coachName: m.coach_id != null ? (coachNameMap[m.coach_id] ?? "-") : "-",
            doneCount: m.done_count,
            totalSessions: m.total_sessions,
            availableTimes: m.available_times,
            followupStatus: m.followup_status,
            followupMemo: m.followup_memo,
          }))}
        />
      </div>
    </div>
  );
}
