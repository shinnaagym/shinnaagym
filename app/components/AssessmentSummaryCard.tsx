"use client";

import Link from "next/link";
import { useState } from "react";
import { DisclosureToggle } from "@/app/components/DisclosureToggle";

/** 평가지 한 건을 요약한 데이터. 서버 쪽(lib/assessments.ts, lib/assessment-
    movements.ts)의 DB 의존 함수를 클라이언트 컴포넌트에서 바로 쓸 수 없어,
    페이지(server component)에서 미리 계산해 내려준다. */
export interface AssessmentSummaryItem {
  id: number;
  dateLabel: string;
  evaluatorName: string;
  maxPain: number | null;
  flaggedLines: string[];
  painTriggerLines: string[];
  exercisePerformanceLines: string[];
}

/** PT 일지 화면의 "상담내용" 바로 아래에서, 그동안 작성한 평가지를 날짜별로
    정리해 보여주는 카드. 기본은 접혀 있고 펼치면 각 평가지의 요약(통증·동작
    체크·운동 수행능력)이 최신순으로 나온다 — 항목을 누르면 그 평가지 상세
    화면으로 이동한다. */
export function AssessmentSummaryCard({
  memberId,
  items,
  title = "📋 평가지 기록",
}: {
  memberId: number;
  items: AssessmentSummaryItem[];
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-5 mb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg mb-1">{title}</p>
          <p className="text-sm text-ink/60">{items.length}건 · 내용 확인하기</p>
        </div>
        <DisclosureToggle
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          label={expanded ? "평가지 기록 접기" : "평가지 기록 펼치기"}
        />
      </div>
      {expanded && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/members/${memberId}/assessment/${item.id}`}
                prefetch={false}
                className="block rounded-xl border border-line/60 px-4 py-3 hover:border-coral/40 transition"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{item.dateLabel}</p>
                  <span className="text-ink/30 text-sm">→</span>
                </div>
                <p className="text-xs text-ink/50 mt-0.5">
                  담당 {item.evaluatorName || "-"}
                  {item.maxPain != null && ` · 최고 통증 ${item.maxPain}/10`}
                </p>
                {(item.flaggedLines.length > 0 ||
                  item.painTriggerLines.length > 0 ||
                  item.exercisePerformanceLines.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-line/50 space-y-0.5 text-xs text-ink/70">
                    {item.flaggedLines.map((line, i) => (
                      <p key={`f-${i}`}>{line}</p>
                    ))}
                    {item.painTriggerLines.map((line, i) => (
                      <p key={`p-${i}`}>{line}</p>
                    ))}
                    {item.exercisePerformanceLines.map((line, i) => (
                      <p key={`e-${i}`}>{line}</p>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
