"use client";

import { useState } from "react";
import { DisclosureToggle } from "@/app/components/DisclosureToggle";
import { PtLogList } from "@/app/admin/members/[id]/pt-log/pt-log-list";
import type { PtLogRow } from "@/lib/db";

/** 예전엔 이 카드를 누르면 별도 페이지(/my/[token]/pt-log)로 이동했는데, 카드
    안에서 바로 펼쳐 보이도록 바꿨다. */
export function PtLogDisclosureCard({ ptLogs }: { ptLogs: PtLogRow[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-5 mb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg mb-1">🏋️ PT 일지</p>
          <p className="text-sm text-ink/60">{ptLogs.length}건 · 내용 확인하기</p>
        </div>
        <DisclosureToggle
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          label={expanded ? "PT 일지 접기" : "PT 일지 펼치기"}
        />
      </div>
      {expanded && (
        <div className="mt-4">
          <PtLogList ptLogs={ptLogs} editable={false} />
        </div>
      )}
    </div>
  );
}
