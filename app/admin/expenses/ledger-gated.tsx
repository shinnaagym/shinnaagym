"use client";

import { useState } from "react";
import { LedgerGate } from "./ledger-gate";
import { ExpensesView } from "./expenses-view";

// PayrollGated와 동일한 이유로, 이 컴포넌트가 새로 마운트될 때마다 unlocked는
// 항상 false로 시작한다(다른 admin 페이지로 나갔다가 다시 가계부로 들어오면
// 서버의 잠금 해제 세션이 아직 유효해도 비밀번호를 다시 확인한다).
export function LedgerGated({ monthKey }: { monthKey: string }) {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <LedgerGate onUnlock={() => setUnlocked(true)} />;
  }

  return <ExpensesView monthKey={monthKey} />;
}
