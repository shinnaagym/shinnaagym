// 종합소득세 예비비 계산에 쓰는 설정값·타입. db를 import하지 않는 순수
// 모듈로 분리해서(lib/payroll/config.ts와 동일한 패턴) 클라이언트 컴포넌트가
// DEFAULT_INCOME_TAX_SETTINGS 같은 기본값을 가져다 쓸 때 pg 등 서버 전용
// 의존성이 브라우저 번들에 섞여 들어가지 않게 한다.

export const INCOME_TAX_RESERVE_RATE = 0.15; // 종합소득세 예비비: 과세표준의 15%
export const INCOME_TAX_VAT_RATE = 0.1; // 카드 매출에 포함된 부가가치세율(매출 ÷ 1.1로 공급가를 역산할 때 씀)

export interface IncomeTaxSettings {
  monthlyRent: number;
  monthlyUtilities: number;
  monthlySupplies: number;
  monthlyMarketing: number;
  cardFeeRate: number;
  monthlyIncomeDeduction: number;
}

// 사용자가 알려준 예상치를 기본값으로 둔다 — 가계부에서 한 번도 저장한 적이
// 없으면(insurance_settings와 동일한 패턴) 이 값을 쓴다.
export const DEFAULT_INCOME_TAX_SETTINGS: IncomeTaxSettings = {
  monthlyRent: 3_000_000,
  monthlyUtilities: 600_000,
  monthlySupplies: 300_000,
  monthlyMarketing: 300_000,
  cardFeeRate: 0.025,
  monthlyIncomeDeduction: 0,
};

export interface IncomeTaxBreakdown {
  revenueExVat: number; // 총수입(PT 매출, 부가세 제외)
  rent: number;
  utilities: number;
  supplies: number;
  marketing: number;
  payroll: number; // 인건비 — 그 달 급여 계산에 기록된 전 직원(정직원+프리랜서) 세전 지급액 합계
  cardFee: number; // 카드 수수료 — 카드 매출 × 카드 수수료율
  totalExpense: number; // 필요경비 합계
  businessIncome: number; // 사업소득금액(총수입 − 필요경비)
  incomeDeduction: number; // 소득공제(본인 기본공제·노란우산공제 등, 월 환산 합계)
  taxableIncomeAuto: number; // 과세표준(자동 계산 — 사업소득금액 − 소득공제)
  taxableIncomeOverride: number | null; // 대표가 직접 입력한 과세표준(있으면)
  taxableIncomeFinal: number; // 15% 계산에 실제로 쓰는 값(override ?? 자동 계산값)
  reserveAmount: number; // 종합소득세 예비비 = max(0, taxableIncomeFinal) × 15%
}
