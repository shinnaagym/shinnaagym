import { query, type ExpenseRow } from "./db";

export async function listExpensesByMonth(yearMonth: string): Promise<ExpenseRow[]> {
  const { rows } = await query<ExpenseRow>(
    `SELECT * FROM expenses WHERE year_month = $1 ORDER BY created_at ASC`,
    [yearMonth],
  );
  return rows;
}

export async function createExpense(input: {
  yearMonth: string;
  item: string;
  amount: number;
  quantity: number;
  note: string;
}): Promise<ExpenseRow> {
  const { rows } = await query<ExpenseRow>(
    `INSERT INTO expenses (year_month, item, amount, quantity, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.yearMonth, input.item, input.amount, input.quantity, input.note],
  );
  return rows[0];
}

export async function deleteExpense(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM expenses WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** 해당 월(YYYY-MM)에 결제된 패키지 대금을 결제 수단별로 합산 — 가계부 옆에 이번 달 매출을 함께 보여주기 위함. */
export async function getPaymentTotalsForMonth(
  yearMonth: string,
): Promise<{ card: number; transfer: number }> {
  const { rows } = await query<{ payment_method: string; total: string }>(
    `SELECT payment_method, COALESCE(SUM(price), 0) AS total
     FROM packages
     WHERE to_char(purchased_at, 'YYYY-MM') = $1
     GROUP BY payment_method`,
    [yearMonth],
  );
  let card = 0;
  let transfer = 0;
  for (const r of rows) {
    if (r.payment_method === "card") card = Number(r.total);
    else if (r.payment_method === "transfer") transfer = Number(r.total);
  }
  return { card, transfer };
}
