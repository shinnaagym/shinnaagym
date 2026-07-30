import type { EmploymentType } from "@/lib/db";
import type { ReferralEntry, ReferralPaymentMethod } from "@/lib/payroll";
import type { PayrollResult } from "@/lib/payroll/calculate";

function formatWon(n: number): string {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: "정직원",
  freelancer: "프리랜서",
};

const REFERRAL_PAYMENT_METHOD_SHORT_LABEL: Record<ReferralPaymentMethod, string> = {
  card: "카드",
  transfer: "계좌이체",
};

function SpecRow({
  label,
  value,
  emphasis = false,
  negative = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  negative?: boolean;
}) {
  if (value === 0 && !emphasis) return null;
  return (
    <div className={["flex items-center justify-between py-1", emphasis ? "font-semibold" : ""].join(" ")}>
      <span className={emphasis ? "" : "text-ink/60"}>{label}</span>
      <span className={negative ? "text-coral" : ""}>
        {negative && value > 0 ? "-" : ""}
        {formatWon(value)}
      </span>
    </div>
  );
}

const CHART_COLORS = ["bg-ink", "bg-sage", "bg-coral", "bg-gold", "bg-gold-deep", "bg-line"];

export function PayComposition({ result }: { result: PayrollResult }) {
  const segments = [
    { label: "기본급", value: result.baseSalary },
    { label: "식대", value: result.mealAllowance },
    { label: "수업료(1:1)", value: result.lessonFee1on1 },
    { label: "수업료(2:1)", value: result.lessonFee2on1 },
    { label: "팀장수당", value: result.teamLeadAllowance },
    { label: "소개 인센티브", value: result.referralIncentive },
  ].filter((s) => s.value > 0);

  if (segments.length === 0) {
    return (
      <div className="h-6 rounded-full bg-line/30 flex items-center justify-center text-xs text-ink/30">
        지급 항목 없음
      </div>
    );
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-6 rounded-full overflow-hidden">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={CHART_COLORS[i % CHART_COLORS.length]}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${formatWon(s.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink/60">
        {segments.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={["inline-block w-2 h-2 rounded-full", CHART_COLORS[i % CHART_COLORS.length]].join(" ")} />
            {s.label} {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function MandatoryGauge({ result }: { result: PayrollResult }) {
  if (result.employmentType === "freelancer") {
    return (
      <p className="text-sm text-ink/50">
        프리랜서는 의무수업이 없어요. 진행한 {result.totalSessions}회가 모두 수업료 대상이에요.
      </p>
    );
  }
  const ratio = result.mandatorySessions > 0 ? Math.min(1, result.totalSessions / result.mandatorySessions) : 1;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span>
          {result.totalSessions.toLocaleString("ko-KR")} / {result.mandatorySessions}회
        </span>
        {result.excessTotal > 0 && (
          <span className="text-coral font-medium">초과 {result.excessTotal.toLocaleString("ko-KR")}회</span>
        )}
      </div>
      <div className="h-3 rounded-full bg-line/30 overflow-hidden">
        <div
          className={ratio >= 1 ? "h-full bg-coral" : "h-full bg-sage"}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function TenureSimulationTable({
  simulations,
  currentBucket,
}: {
  simulations: PayrollResult[];
  currentBucket: string;
}) {
  return (
    <>
      {/* 좁은 화면에서는 표 대신 항목별 카드로 쌓아 열이 서로 겹치지 않게 한다. */}
      <div className="sm:hidden space-y-2">
        {simulations.map((sim) => (
          <div
            key={sim.tenureBucket}
            className={[
              "rounded-xl border px-3 py-2.5 text-sm",
              sim.tenureBucket === currentBucket
                ? "border-coral/40 bg-coral/5"
                : "border-line/60",
            ].join(" ")}
          >
            <p className="font-medium mb-1.5">
              {sim.tenureLabel}
              {sim.tenureBucket === currentBucket && (
                <span className="ml-1.5 text-[11px] text-coral font-normal">현재</span>
              )}
            </p>
            <div className="flex items-center justify-between text-ink/60">
              <span>1:1 단가</span>
              <span>{formatWon(sim.rate1on1)}</span>
            </div>
            <div className="flex items-center justify-between text-ink/60">
              <span>수업료 합계</span>
              <span>{formatWon(sim.lessonFeeTotal)}</span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>실지급액</span>
              <span>{formatWon(sim.netPay)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50 text-xs border-b border-line/60">
              <th className="py-2 font-medium">근속 구간</th>
              <th className="py-2 font-medium text-right">1:1 단가</th>
              <th className="py-2 font-medium text-right">수업료 합계</th>
              <th className="py-2 font-medium text-right">실지급액</th>
            </tr>
          </thead>
          <tbody>
            {simulations.map((sim) => (
              <tr
                key={sim.tenureBucket}
                className={[
                  "border-b border-line/40 last:border-0",
                  sim.tenureBucket === currentBucket ? "bg-coral/5 font-medium" : "",
                ].join(" ")}
              >
                <td className="py-2">
                  {sim.tenureLabel}
                  {sim.tenureBucket === currentBucket && (
                    <span className="ml-1.5 text-[11px] text-coral">현재</span>
                  )}
                </td>
                <td className="py-2 text-right">{formatWon(sim.rate1on1)}</td>
                <td className="py-2 text-right">{formatWon(sim.lessonFeeTotal)}</td>
                <td className="py-2 text-right">{formatWon(sim.netPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 급여명세서 카드 하나. 실시간 계산 화면과 저장된 이력의 상세보기에서 공통으로 쓴다. */
export function PayrollSpecCard({
  employeeName,
  yearMonth,
  result,
  referralEntries,
}: {
  employeeName: string;
  yearMonth: string;
  result: PayrollResult;
  referralEntries?: ReferralEntry[];
}) {
  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg">{employeeName} 급여명세서</h2>
          <p className="text-xs text-ink/50">
            {yearMonth} · {EMPLOYMENT_TYPE_LABEL[result.employmentType]} · {result.tenureLabel}
          </p>
        </div>
      </div>

      <div className="text-sm divide-y divide-line/40">
        <SpecRow label="기본급" value={result.baseSalary} />
        <SpecRow label="식대(비과세)" value={result.mealAllowance} />
        <SpecRow label="수업료(1:1)" value={result.lessonFee1on1} />
        <SpecRow label="수업료(2:1)" value={result.lessonFee2on1} />
        <SpecRow label="팀장수당" value={result.teamLeadAllowance} />
        <SpecRow label="소개 인센티브(부가세 제외 5%)" value={result.referralIncentive} />
        <SpecRow label="총지급액" value={result.grossPay} emphasis />
      </div>

      {referralEntries && referralEntries.length > 0 && (
        <div className="text-xs text-ink/50 mt-3 pt-3 border-t border-line/60">
          <p className="mb-1.5 font-medium text-ink/60">소개 결제 내역</p>
          {referralEntries.map((entry, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <span>
                {entry.note || "(내용 없음)"}
                <span className="ml-1 text-ink/40">
                  ({REFERRAL_PAYMENT_METHOD_SHORT_LABEL[entry.paymentMethod]})
                </span>
              </span>
              <span>{formatWon(entry.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-sm divide-y divide-line/40 mt-3 pt-3 border-t border-line/60">
        {result.employmentType === "regular" ? (
          <>
            <SpecRow label="국민연금(4.5%)" value={result.deductions.nationalPension} negative />
            <SpecRow label="건강보험(3.545%)" value={result.deductions.healthInsurance} negative />
            <SpecRow label="장기요양보험" value={result.deductions.longTermCare} negative />
            <SpecRow label="고용보험(0.9%)" value={result.deductions.employmentInsurance} negative />
          </>
        ) : (
          <SpecRow label="원천징수(3.3%)" value={result.deductions.freelancerWithholding} negative />
        )}
        <SpecRow label="실지급액" value={result.netPay} emphasis />
      </div>

      {result.employmentType === "regular" && (
        <p className="text-xs text-ink/40 mt-3">
          * 근로소득세는 간이세액표 기준 계산이 필요해 이 화면에서는 제외했어요(소득세 별도).
        </p>
      )}

      {result.severanceEstimate !== null && (
        <p className="text-xs text-ink/50 mt-2">
          퇴직금 누적 예상액(간이 계산): {formatWon(result.severanceEstimate)} — 실제 퇴직금은
          퇴사 직전 3개월 평균임금 기준이라 차이가 날 수 있어요.
        </p>
      )}
    </div>
  );
}

export function PayrollResultCards({
  employeeName,
  yearMonth,
  result,
  comparisonResult,
  comparisonEmploymentType,
  tenureSimulations,
}: {
  employeeName: string;
  yearMonth: string;
  result: PayrollResult;
  comparisonResult: PayrollResult;
  comparisonEmploymentType: EmploymentType;
  tenureSimulations: PayrollResult[];
}) {
  return (
    <div className="space-y-6">
      <PayrollSpecCard employeeName={employeeName} yearMonth={yearMonth} result={result} />

      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-3">의무수업 진행 현황</h3>
        <MandatoryGauge result={result} />
      </div>

      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-3">지급 항목 구성</h3>
        <PayComposition result={result} />
      </div>

      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-1">근속 시뮬레이션</h3>
        <p className="text-xs text-ink/50 mb-3">
          같은 수업 횟수를 진행했다고 가정했을 때, 근속 구간별 수업료·실지급액 비교예요.
        </p>
        <TenureSimulationTable simulations={tenureSimulations} currentBucket={result.tenureBucket} />
      </div>

      <div className="rounded-2xl border border-line/60 bg-white shadow-sm p-5">
        <h3 className="font-display text-base mb-1">
          {EMPLOYMENT_TYPE_LABEL[result.employmentType]} vs {EMPLOYMENT_TYPE_LABEL[comparisonEmploymentType]}
        </h3>
        <p className="text-xs text-ink/50 mb-3">
          같은 근속·수업 횟수 조건으로 고용형태만 바꿔봤을 때의 실수령액 비교예요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-coral/40 bg-coral/5 p-3">
            <p className="text-xs text-ink/50 mb-1">{EMPLOYMENT_TYPE_LABEL[result.employmentType]}(현재)</p>
            <p className="font-semibold">{formatWon(result.netPay)}</p>
            <p className="text-xs text-ink/40 mt-1">총지급액 {formatWon(result.grossPay)}</p>
          </div>
          <div className="rounded-xl border border-line/60 p-3">
            <p className="text-xs text-ink/50 mb-1">{EMPLOYMENT_TYPE_LABEL[comparisonEmploymentType]}(비교)</p>
            <p className="font-semibold">{formatWon(comparisonResult.netPay)}</p>
            <p className="text-xs text-ink/40 mt-1">총지급액 {formatWon(comparisonResult.grossPay)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
