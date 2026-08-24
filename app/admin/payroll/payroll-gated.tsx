"use client";

import { useState } from "react";
import type { CoachRow } from "@/lib/db";
import { PayrollGate } from "./payroll-gate";
import { PayrollView } from "./payroll-view";

// 이 컴포넌트가 새로 마운트될 때마다(=/admin/payroll에 새로 진입할 때마다)
// unlocked는 initialUnlocked로 시작한다 — 가계부 2차 비밀번호 세션이 아직
// 유효하면(page.tsx가 서버에서 isPayrollAuthed()로 미리 확인) 다시 묻지
// 않고, 그렇지 않으면 기존처럼 false로 시작해 비밀번호를 다시 확인한다.
// 서버의 payroll/ledger 세션 쿠키는 잠금 해제 화면에서 벗어날지 여부와
// 무관하게, 잠금 해제된 동안 데이터 API 호출(session-counts, payroll
// 저장/조회)이 통과하도록 뒷받침하는 용도로만 쓰인다.
export function PayrollGated({
  coaches,
  defaultYearMonth,
  initialUnlocked,
}: {
  coaches: CoachRow[];
  defaultYearMonth: string;
  initialUnlocked: boolean;
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);

  if (!unlocked) {
    return <PayrollGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PayrollView coaches={coaches} defaultYearMonth={defaultYearMonth} />;
}
