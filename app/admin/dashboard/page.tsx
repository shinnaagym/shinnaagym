import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey, koreaCurrentMonthKey } from "@/lib/date";
import {
  getCoachMonthlyReports,
  getDashboardOverview,
  getMonthlyRetentionStats,
  getMonthlyTrend,
  listNewRegistrations,
  listPackagePurchases,
  listRefundsForMonth,
} from "@/lib/schedule";
import { getVisitChannelCountsForMonth } from "@/lib/intake";
import { VISIT_CHANNEL_OPTIONS } from "@/lib/intake-questionnaire";
import { DashboardMonthPicker } from "./month-picker";

const TREND_MONTHS = 6;

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function formatMonthShort(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return `${Number(m)}월`;
}

// 방문 경로별 브랜드/성격에 맞춘 그래프 색상 — 네이버 계열(블로그·카페)은 네이버
// 브랜드 그린, 인스타그램은 인스타그램 핑크 계열로 한눈에 구분되게 한다.
const VISIT_CHANNEL_COLORS: Record<string, string> = {
  blog: "#5FA777",
  naver_cafe: "#03C75A",
  instagram: "#E1306C",
  signboard: "#F2A93B",
  banner: "#4A90D9",
  flyer: "#9B6B43",
  referral: "#FF6F61",
  other: "#9AA0A6",
};
// 방문 경로 "기타"를 고르고 자유 입력한 텍스트는 카테고리가 미리 정해져 있지 않으므로,
// 문자열을 해시해 고정 팔레트에서 색을 골라 매번 같은 문구가 같은 색을 쓰도록 한다.
const CUSTOM_VISIT_CHANNEL_FALLBACK_COLORS = ["#7B8FA1", "#B08CC2", "#6FA8A0", "#D48B5D"];
function colorForVisitChannel(key: string): string {
  if (VISIT_CHANNEL_COLORS[key]) return VISIT_CHANNEL_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CUSTOM_VISIT_CHANNEL_FALLBACK_COLORS[hash % CUSTOM_VISIT_CHANNEL_FALLBACK_COLORS.length];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatRate(rate: number | null): string {
  return rate === null ? "-" : `${Math.round(rate * 100)}%`;
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white border border-line/60 shadow-sm animate-pulse ${className}`}
    />
  );
}

export default async function AdminDashboardPage({
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Dashboard</p>
      <h1 className="font-display text-2xl mb-1">대시보드</h1>
      <p className="text-sm text-ink/50 mb-6">이번 달 운영 현황을 한눈에 확인하세요.</p>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <p className="font-display text-lg">{formatMonthLabel(monthKey)}</p>
      </div>
      <DashboardMonthPicker monthKey={monthKey} />

      {/* 각 섹션을 독립된 Suspense 경계로 감싸서, 쿼리가 오래 걸리는 섹션 때문에
          이미 준비된 다른 섹션까지 화면에 안 나타나고 함께 멈춰있지 않게 한다 —
          섹션마다 데이터가 준비되는 대로 스트리밍되어 순서와 무관하게 뜬다. */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards monthKey={monthKey} />
      </Suspense>

      <Suspense fallback={<TrendChartsSkeleton />}>
        <TrendCharts monthKey={monthKey} />
      </Suspense>

      <Suspense fallback={<CoachReportSkeleton />}>
        <CoachReportSection monthKey={monthKey} />
      </Suspense>

      <Suspense fallback={<VisitChannelSkeleton />}>
        <VisitChannelSection monthKey={monthKey} />
      </Suspense>

      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivitySection monthKey={monthKey} />
      </Suspense>

      <p className="text-xs text-ink/40 mt-4 leading-relaxed">
        매출은 그 달에 결제된 패키지 금액 합계이고, 수업수는 취소되지 않은 수업(노쇼·예정 포함)
        건수예요. 신규 등록은 첫 패키지를 이번 달에 구매한 회원, 재등록은 이미 패키지가 있던
        회원이 이번 달에 추가로 구매한 경우예요.
      </p>
    </div>
  );
}

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {Array.from({ length: 7 }).map((_, i) => (
        <CardSkeleton key={i} className="h-[76px]" />
      ))}
    </div>
  );
}

async function KpiCards({ monthKey }: { monthKey: string }) {
  const overview = await getDashboardOverview(monthKey);

  const kpiCards: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: "활성 회원", value: `${overview.activeMemberCount}명` },
    { label: "이번 달 총 상담수", value: `${overview.monthlyConsultationCount}건` },
    { label: "카드결제 매출 (부가세포함)", value: formatWon(overview.monthlyRevenueCard), accent: true },
    { label: "계좌이체 매출 (부가세제외)", value: formatWon(overview.monthlyRevenueTransfer), accent: true },
    { label: "이번 달 신규 등록", value: `${overview.monthlyNewMemberCount}명` },
    { label: "이번 달 재등록", value: `${overview.monthlyReRegisteredMemberCount}명` },
    { label: "노쇼율", value: formatRate(overview.noShowRate) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {kpiCards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl bg-white border border-line/60 shadow-sm px-4 sm:px-5 py-4"
        >
          <p className="text-xs text-ink/50 mb-2">{card.label}</p>
          <p className={`text-lg sm:text-2xl font-semibold ${card.accent ? "text-gold-deep" : "text-ink"}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function TrendChartsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} className="h-[196px]" />
      ))}
    </div>
  );
}

async function TrendCharts({ monthKey }: { monthKey: string }) {
  const [trend, retentionTrend] = await Promise.all([
    getMonthlyTrend(monthKey, TREND_MONTHS),
    getMonthlyRetentionStats(monthKey, TREND_MONTHS),
  ]);

  const maxRevenue = Math.max(1, ...trend.map((t) => t.revenue));
  const maxSessions = Math.max(1, ...trend.map((t) => t.sessionCount));
  const maxConsultations = Math.max(1, ...trend.map((t) => t.consultationCount));
  const maxNewRegs = Math.max(1, ...retentionTrend.map((t) => t.newMemberCount));

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <p className="text-sm font-medium mb-4">
          월별 결제액 <span className="text-xs text-ink/40 font-normal">최근 {TREND_MONTHS}개월</span>
        </p>
        <div className="flex items-end gap-2 h-36">
          {trend.map((t) => (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-ink/50 h-3">
                {t.revenue > 0 ? `${Math.round(t.revenue / 10000)}만` : ""}
              </p>
              <div
                className={`w-full rounded-t-md transition-all ${
                  t.month === monthKey ? "bg-gold" : "bg-gold/30"
                }`}
                style={{ height: `${Math.max(4, (t.revenue / maxRevenue) * 100)}px` }}
              />
              <p className="text-[10px] text-ink/40">{formatMonthShort(t.month)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <p className="text-sm font-medium mb-4">
          월별 수업수{" "}
          <span className="text-xs text-ink/40 font-normal">최근 {TREND_MONTHS}개월</span>
        </p>
        <div className="flex items-end gap-2 h-36">
          {trend.map((t) => (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-ink/50 h-3">{t.sessionCount > 0 ? t.sessionCount : ""}</p>
              <div
                className={`w-full rounded-t-md transition-all ${
                  t.month === monthKey ? "bg-sage" : "bg-sage/40"
                }`}
                style={{ height: `${Math.max(4, (t.sessionCount / maxSessions) * 100)}px` }}
              />
              <p className="text-[10px] text-ink/40">{formatMonthShort(t.month)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <p className="text-sm font-medium mb-4">
          월별 상담수{" "}
          <span className="text-xs text-ink/40 font-normal">최근 {TREND_MONTHS}개월</span>
        </p>
        <div className="flex items-end gap-2 h-36">
          {trend.map((t) => (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-ink/50 h-3">
                {t.consultationCount > 0 ? t.consultationCount : ""}
              </p>
              <div
                className={`w-full rounded-t-md transition-all ${
                  t.month === monthKey ? "bg-coral" : "bg-coral/30"
                }`}
                style={{
                  height: `${Math.max(4, (t.consultationCount / maxConsultations) * 100)}px`,
                }}
              />
              <p className="text-[10px] text-ink/40">{formatMonthShort(t.month)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <p className="text-sm font-medium mb-4">
          월별 신규 등록{" "}
          <span className="text-xs text-ink/40 font-normal">최근 {TREND_MONTHS}개월</span>
        </p>
        <div className="flex items-end gap-2 h-36">
          {retentionTrend.map((t) => (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-ink/50 h-3">
                {t.newMemberCount > 0 ? `${t.newMemberCount}명` : ""}
              </p>
              <div
                className={`w-full rounded-t-md transition-all ${
                  t.month === monthKey ? "bg-gold-light" : "bg-gold-light/40"
                }`}
                style={{
                  height: `${Math.max(4, (t.newMemberCount / maxNewRegs) * 100)}px`,
                }}
              />
              <p className="text-[10px] text-ink/40">{formatMonthShort(t.month)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoachReportSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:hidden mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[92px]" />
        ))}
      </div>
      <CardSkeleton className="hidden sm:block h-64 mb-6" />
    </>
  );
}

async function CoachReportSection({ monthKey }: { monthKey: string }) {
  const coachReports = await getCoachMonthlyReports(monthKey);

  return (
    <>
      {/* 트레이너별 성과 — 모바일 카드 */}
      <div className="grid gap-3 sm:hidden mb-6">
        {coachReports.map((r) => (
          <div key={r.coachId} className="rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{r.coachName}</span>
              <span className="text-gold-deep font-semibold">{formatWon(r.revenue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-ink/60">
              <span>담당 {r.memberCount}명</span>
              <span>
                1:1 {r.sessionCount1on1}회 · 2:1 {r.sessionCount2on1}회
              </span>
              <span>노쇼 {r.noShowCount}회</span>
              <span>재등록율 {formatRate(r.reRegistrationRate)}</span>
              <span>월 상담수 {r.consultationCount}명</span>
              <span>상담 성공율 {formatRate(r.consultationSuccessRate)}</span>
            </div>
          </div>
        ))}
        {coachReports.length === 0 && <p className="text-center text-ink/40 py-6">코치가 없어요.</p>}
      </div>

      {/* 트레이너별 성과 — 데스크톱 표 */}
      <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-ink/50 text-xs border-b border-line/60">
              <th className="px-5 py-3 font-medium">코치</th>
              <th className="px-5 py-3 font-medium">담당 회원</th>
              <th className="px-5 py-3 font-medium">1:1</th>
              <th className="px-5 py-3 font-medium">2:1</th>
              <th className="px-5 py-3 font-medium">노쇼</th>
              <th className="px-5 py-3 font-medium">매출</th>
              <th className="px-5 py-3 font-medium">재등록율</th>
              <th className="px-5 py-3 font-medium">월 상담수</th>
              <th className="px-5 py-3 font-medium">상담 성공율</th>
            </tr>
          </thead>
          <tbody>
            {coachReports.map((r) => (
              <tr key={r.coachId} className="border-b border-line/40 last:border-0">
                <td className="px-5 py-3 font-medium">{r.coachName}</td>
                <td className="px-5 py-3 text-ink/70">{r.memberCount}명</td>
                <td className="px-5 py-3 text-ink/70">{r.sessionCount1on1}회</td>
                <td className="px-5 py-3 text-ink/70">{r.sessionCount2on1}회</td>
                <td className="px-5 py-3 text-ink/70">{r.noShowCount}회</td>
                <td className="px-5 py-3 text-gold-deep font-medium">{formatWon(r.revenue)}</td>
                <td className="px-5 py-3 text-ink/70">{formatRate(r.reRegistrationRate)}</td>
                <td className="px-5 py-3 text-ink/70">{r.consultationCount}명</td>
                <td className="px-5 py-3 text-ink/70">{formatRate(r.consultationSuccessRate)}</td>
              </tr>
            ))}
            {coachReports.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink/40">
                  코치가 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VisitChannelSkeleton() {
  return <CardSkeleton className="h-[172px] mb-6" />;
}

async function VisitChannelSection({ monthKey }: { monthKey: string }) {
  const visitChannelCounts = await getVisitChannelCountsForMonth(monthKey);

  const visitChannelTotal = Object.values(visitChannelCounts).reduce((a, b) => a + b, 0);
  const knownVisitChannelValues = new Set<string>(VISIT_CHANNEL_OPTIONS.map((opt) => opt.value));
  const visitChannelFixedRows = VISIT_CHANNEL_OPTIONS.filter((opt) => opt.value !== "other").map(
    (opt) => ({ label: opt.label, value: opt.value as string, count: visitChannelCounts[opt.value] ?? 0 }),
  );
  // "기타"를 고르고 자유 입력을 남긴 경우, 그 텍스트 자체가 getVisitChannelCountsForMonth에서
  // 이미 새 카테고리 키로 집계되어 있다 — 여기서는 알려진 값이 아닌 키를 전부 모아 동적으로 보여준다.
  const customVisitChannelRows = Object.entries(visitChannelCounts)
    .filter(([key]) => key !== "" && !knownVisitChannelValues.has(key))
    .map(([label, count]) => ({ label, value: label, count }))
    .sort((a, b) => b.count - a.count);
  const visitChannelRows = [
    ...visitChannelFixedRows,
    { label: "기타", value: "other", count: visitChannelCounts["other"] ?? 0 },
    ...customVisitChannelRows,
  ];
  const unknownVisitChannelCount = visitChannelCounts[""] ?? 0;
  const maxVisitChannelCount = Math.max(1, ...visitChannelRows.map((r) => r.count), unknownVisitChannelCount);

  return (
    <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 mb-6">
      <p className="text-sm font-medium mb-3">
        이번 달 방문 경로{" "}
        <span className="text-xs text-ink/40 font-normal">초진 문진표 기준 · 총 {visitChannelTotal}건</span>
      </p>
      {visitChannelTotal === 0 ? (
        <p className="text-sm text-ink/40">이번 달 작성된 문진표가 없어요.</p>
      ) : (
        <div className="space-y-2">
          {visitChannelRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-ink/60">{row.label}</span>
              <div className="flex-1 h-4 rounded-full bg-bone overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.count / maxVisitChannelCount) * 100}%`,
                    backgroundColor: colorForVisitChannel(row.value),
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs text-ink/70">{row.count}</span>
            </div>
          ))}
          {unknownVisitChannelCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-ink/40">미입력</span>
              <div className="flex-1 h-4 rounded-full bg-bone overflow-hidden">
                <div
                  className="h-full rounded-full bg-line"
                  style={{ width: `${(unknownVisitChannelCount / maxVisitChannelCount) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs text-ink/40">{unknownVisitChannelCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecentActivitySkeleton() {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} className="h-[220px]" />
      ))}
    </div>
  );
}

async function RecentActivitySection({ monthKey }: { monthKey: string }) {
  const [newRegs, purchases, refunds] = await Promise.all([
    listNewRegistrations(monthKey),
    listPackagePurchases(monthKey),
    listRefundsForMonth(monthKey),
  ]);

  const newRegByCoach = new Map<string, string[]>();
  for (const r of newRegs) {
    const names = newRegByCoach.get(r.coachName) ?? [];
    names.push(r.memberName);
    newRegByCoach.set(r.coachName, names);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* 이번 달 신규 PT 등록 */}
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 min-w-0">
        <p className="text-sm font-medium mb-3">이번 달 신규 PT 등록</p>
        {newRegs.length === 0 ? (
          <p className="text-sm text-ink/40">이번 달 신규 등록이 없어요.</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {[...newRegByCoach.entries()].map(([coachName, names]) => (
              <li key={coachName} className="flex items-start justify-between gap-3">
                <span className="text-ink/70 shrink-0">{coachName}</span>
                <span className="text-right">
                  <span className="font-medium">{names.length}명</span>
                  <span className="block text-xs text-ink/40">{names.join(", ")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PT 결제 내역 */}
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 min-w-0">
        <p className="text-sm font-medium mb-3">PT 결제 내역</p>
        {purchases.length === 0 ? (
          <p className="text-sm text-ink/40">이번 달 결제 내역이 없어요.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-line/30 last:border-0">
                    <td className="py-2 pr-2 text-ink/40 whitespace-nowrap">{formatDate(p.purchasedAt)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{p.memberName}</td>
                    <td className="py-2 pr-2 text-ink/50 whitespace-nowrap">{p.totalSessions}회</td>
                    <td className="py-2 pr-2 text-gold-deep font-medium whitespace-nowrap">
                      {formatWon(p.price)}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <span
                        className={[
                          "text-[10px] rounded-full px-1.5 py-0.5",
                          p.isFirst ? "bg-coral/10 text-coral" : "bg-sage/20 text-sage",
                        ].join(" ")}
                      >
                        {p.isFirst ? "신규" : "재등록"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PT 환불 내역 */}
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5 min-w-0">
        <p className="text-sm font-medium mb-3">PT 환불 내역</p>
        {refunds.length === 0 ? (
          <p className="text-sm text-ink/40">이번 달 환불 내역이 없어요.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-line/30 last:border-0">
                    <td className="py-2 pr-2 text-ink/40 whitespace-nowrap">{formatDate(r.refundedAt)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{r.memberName}</td>
                    <td className="py-2 whitespace-nowrap text-coral font-medium">−{formatWon(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
