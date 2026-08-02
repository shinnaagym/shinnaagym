"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { koreaCurrentMonthKey } from "@/lib/date";
import { PT_LOG_EQUIPMENT_LABELS } from "@/lib/constants";
import { DeletePtLogButton } from "@/app/components/DeletePtLogButton";
import type { PtLogExercise, PtLogRow } from "@/lib/db";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function monthKeyOf(log: PtLogRow): string {
  return (log.log_date || log.created_at.slice(0, 10)).slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function exerciseSummary(e: PtLogExercise): string {
  const equipmentLabel = PT_LOG_EQUIPMENT_LABELS[e.equipment] ?? e.equipment;
  const groups =
    e.groups
      .map((g) => {
        const parts: string[] = [];
        if (g.weight != null) parts.push(`${g.weight}kg`);
        if (g.reps != null) parts.push(`${g.reps}회`);
        if (g.sets != null) parts.push(`${g.sets}set`);
        return parts.join(" ");
      })
      .filter((s) => s.length > 0)
      .join(", ") || "-";
  return `(${equipmentLabel})${e.name} — ${groups}`;
}

export function PtLogList({ ptLogs, editable = true }: { ptLogs: PtLogRow[]; editable?: boolean }) {
  const months = useMemo(() => {
    const set = new Set(ptLogs.map(monthKeyOf));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [ptLogs]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const current = koreaCurrentMonthKey();
    if (months.includes(current)) return current;
    return months[0] ?? current;
  });

  const filtered = useMemo(
    () => ptLogs.filter((log) => monthKeyOf(log) === selectedMonth),
    [ptLogs, selectedMonth],
  );

  if (ptLogs.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-line/60 px-5 py-10 text-center text-ink/40">
        아직 작성된 PT 일지가 없어요.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-coral"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink/40">{filtered.length}건</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 px-5 py-10 text-center text-ink/40">
          {monthLabel(selectedMonth)}에는 기록된 PT 일지가 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log) => (
            <li
              key={log.id}
              className={[
                "relative rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4",
                editable ? "pr-28" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.log_date || formatDateTime(log.created_at)}</p>
                  {(log.pain_scale != null || log.memo) && (
                    <p className="text-xs text-ink/50 mt-0.5">
                      {log.pain_scale != null && `통증 ${log.pain_scale}/10`}
                      {log.pain_scale != null && log.memo && " · "}
                      {log.memo}
                    </p>
                  )}
                </div>
              </div>
              {log.exercises.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line/50 space-y-1 text-sm text-ink/70">
                  {log.exercises.map((e, i) => (
                    <p key={i}>{exerciseSummary(e)}</p>
                  ))}
                </div>
              )}
              {editable && (
                <div className="absolute top-4 right-5 flex items-center gap-2 text-xs">
                  <Link
                    href={`/admin/members/${log.member_id}/pt-log/${log.id}/edit`}
                    className="text-ink/40 hover:text-coral"
                  >
                    수정
                  </Link>
                  <DeletePtLogButton ptLogId={log.id} className="text-ink/40 hover:text-coral" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
