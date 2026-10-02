import { query } from "./db";
import type { IncomeTaxOverrideRow, IncomeTaxSettingsRow } from "./db";
import { getPaymentTotalsForMonth } from "./expenses";
import { listPayrollRecords } from "./payroll";
import type { PayrollResult } from "./payroll/calculate";
import {
  DEFAULT_INCOME_TAX_SETTINGS,
  INCOME_TAX_RESERVE_RATE,
  INCOME_TAX_VAT_RATE,
  type IncomeTaxBreakdown,
  type IncomeTaxSettings,
} from "./income-tax/config";

export { DEFAULT_INCOME_TAX_SETTINGS, INCOME_TAX_RESERVE_RATE };
export type { IncomeTaxBreakdown, IncomeTaxSettings };

export async function getIncomeTaxSettings(): Promise<IncomeTaxSettings> {
  const { rows } = await query<IncomeTaxSettingsRow>(`SELECT * FROM income_tax_settings WHERE id = 1`);
  const row = rows[0];
  if (!row) return DEFAULT_INCOME_TAX_SETTINGS;
  return {
    monthlyRent: row.monthly_rent,
    monthlyUtilities: row.monthly_utilities,
    monthlySupplies: row.monthly_supplies,
    monthlyMarketing: row.monthly_marketing,
    cardFeeRate: row.card_fee_rate,
    monthlyIncomeDeduction: row.monthly_income_deduction,
  };
}

export async function saveIncomeTaxSettings(settings: IncomeTaxSettings): Promise<IncomeTaxSettings> {
  await query(
    `INSERT INTO income_tax_settings
       (id, monthly_rent, monthly_utilities, monthly_supplies, monthly_marketing, card_fee_rate, monthly_income_deduction, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET
       monthly_rent = EXCLUDED.monthly_rent,
       monthly_utilities = EXCLUDED.monthly_utilities,
       monthly_supplies = EXCLUDED.monthly_supplies,
       monthly_marketing = EXCLUDED.monthly_marketing,
       card_fee_rate = EXCLUDED.card_fee_rate,
       monthly_income_deduction = EXCLUDED.monthly_income_deduction,
       updated_at = now()`,
    [
      settings.monthlyRent,
      settings.monthlyUtilities,
      settings.monthlySupplies,
      settings.monthlyMarketing,
      settings.cardFeeRate,
      settings.monthlyIncomeDeduction,
    ],
  );
  return settings;
}

/** 그 달의 과세표준을 대표가 직접 덮어쓴 값. 없으면 null(자동 계산값을 그대로 씀). */
export async function getTaxableIncomeOverride(yearMonth: string): Promise<number | null> {
  const { rows } = await query<IncomeTaxOverrideRow>(
    `SELECT * FROM income_tax_overrides WHERE year_month = $1`,
    [yearMonth],
  );
  return rows[0]?.taxable_income ?? null;
}

export async function setTaxableIncomeOverride(
  yearMonth: string,
  taxableIncome: number | null,
): Promise<void> {
  if (taxableIncome === null) {
    await query(`DELETE FROM income_tax_overrides WHERE year_month = $1`, [yearMonth]);
    return;
  }
  await query(
    `INSERT INTO income_tax_overrides (year_month, taxable_income, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (year_month) DO UPDATE SET taxable_income = EXCLUDED.taxable_income, updated_at = now()`,
    [yearMonth, taxableIncome],
  );
}

/**
 * 종합소득세 예비비를 "월 순이익의 15%"라는 단순 추정 대신, 실제 사업소득
 * 산출 흐름(총수입 − 필요경비 = 사업소득금액 − 소득공제 = 과세표준 → 15%)으로
 * 계산한다. 필요경비 중 월세·관리비·장비소모품·마케팅비·소득공제는 가계부에서
 * 저장한 설정값을, 인건비는 그 달 실제 급여 계산 결과를, 카드 수수료는
 * 카드 매출에 설정된 수수료율을 곱해서 구한다.
 */
export async function computeIncomeTaxBreakdown(yearMonth: string): Promise<IncomeTaxBreakdown> {
  const [settings, paymentTotals, payrollRecords, override] = await Promise.all([
    getIncomeTaxSettings(),
    getPaymentTotalsForMonth(yearMonth),
    listPayrollRecords({ yearMonth }),
    getTaxableIncomeOverride(yearMonth),
  ]);

  // 카드 매출은 부가세 포함가라 ÷1.1로 공급가(순매출)를 역산하고, 계좌이체는
  // 이미 부가세 제외 금액이라 그대로 더한다.
  const revenueExVat = Math.round(paymentTotals.card / (1 + INCOME_TAX_VAT_RATE)) + paymentTotals.transfer;
  const payroll = payrollRecords.reduce(
    (sum, r) => sum + (r.result as PayrollResult).grossPay,
    0,
  );
  const cardFee = Math.round(paymentTotals.card * settings.cardFeeRate);
  const totalExpense =
    settings.monthlyRent +
    settings.monthlyUtilities +
    settings.monthlySupplies +
    settings.monthlyMarketing +
    payroll +
    cardFee;
  const businessIncome = revenueExVat - totalExpense;
  const taxableIncomeAuto = businessIncome - settings.monthlyIncomeDeduction;
  const taxableIncomeFinal = override ?? taxableIncomeAuto;
  const reserveAmount = Math.round(Math.max(0, taxableIncomeFinal) * INCOME_TAX_RESERVE_RATE);

  return {
    revenueExVat,
    rent: settings.monthlyRent,
    utilities: settings.monthlyUtilities,
    supplies: settings.monthlySupplies,
    marketing: settings.monthlyMarketing,
    payroll,
    cardFee,
    totalExpense,
    businessIncome,
    incomeDeduction: settings.monthlyIncomeDeduction,
    taxableIncomeAuto,
    taxableIncomeOverride: override,
    taxableIncomeFinal,
    reserveAmount,
  };
}
