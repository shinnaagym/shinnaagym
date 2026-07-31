"use client";

import { useRouter } from "next/navigation";
import { koreaCurrentMonthKey } from "@/lib/date";

const YEAR_RANGE = 2; // 올해 기준 앞뒤로 보여줄 연도 폭

function pillClass(active: boolean): string {
  return [
    "rounded-full px-3 py-1.5 text-sm font-medium transition border",
    active ? "bg-ink text-white border-ink" : "border-line text-ink/60 hover:bg-bone",
  ].join(" ");
}

export function ExpenseMonthPicker({ monthKey }: { monthKey: string }) {
  const router = useRouter();
  const [selectedYear, selectedMonth] = monthKey.split("-").map(Number);
  const currentYear = Number(koreaCurrentMonthKey().split("-")[0]);
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => currentYear - YEAR_RANGE + i);

  function go(year: number, month: number) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    router.push(`/admin/expenses?month=${key}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => go(y, selectedMonth)}
            className={pillClass(y === selectedYear)}
          >
            {y}년
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => go(selectedYear, m)}
            className={pillClass(m === selectedMonth)}
          >
            {m}월
          </button>
        ))}
      </div>
    </div>
  );
}
