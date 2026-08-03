"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { koreaCurrentMonthKey } from "@/lib/date";
import {
  PT_LOG_EQUIPMENT_LABELS,
  PT_LOG_CIRCUIT_TYPE_LABELS,
  PT_LOG_CIRCUIT_FIELD_CONFIG,
} from "@/lib/constants";
import { DeletePtLogButton } from "@/app/components/DeletePtLogButton";
import type { PtLogExercise } from "@/lib/db";

/** PtLogRow(PT 일지)·PersonalExerciseRow(개인 운동) 둘 다 이 모양을 만족해서,
    이 목록 컴포넌트는 두 타입 어디에나 그대로 쓸 수 있다. pain_scale은 PT
    일지에만 있어 선택 필드로 둔다. */
export interface PtLogListRow {
  id: number;
  member_id: number;
  log_date: string;
  memo: string;
  created_at: string;
  exercises: PtLogExercise[];
  pain_scale?: number | null;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function monthKeyOf(log: PtLogListRow): string {
  return (log.log_date || log.created_at.slice(0, 10)).slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 무게·횟수 칸이 순수 숫자면 "kg"/"회" 단위를 붙이고, "밴드 3단계"·"30초"처럼
    자유 텍스트면 그대로 보여준다(단위를 잘못 덧붙이지 않도록). 이 기능이 생기기
    전에 저장된 옛 PT 일지는 weight/reps가 문자열이 아니라 숫자로 남아있어서,
    String()로 먼저 바꿔주지 않으면 .trim()이 없어 페이지가 깨진다. */
function isNumericText(s: string | number): boolean {
  return /^-?\d+(\.\d+)?$/.test(String(s).trim());
}

export function exerciseSummary(e: PtLogExercise): string {
  if (e.equipment === "circuit" && e.circuit) {
    const typeLabel = PT_LOG_CIRCUIT_TYPE_LABELS[e.circuit.type] ?? e.circuit.type;
    const config = PT_LOG_CIRCUIT_FIELD_CONFIG[e.circuit.type];
    const parts: string[] = [];
    if (e.circuit.minutes != null) {
      parts.push(`${config?.minutesLabel ?? "시간"} ${e.circuit.minutes}분`);
    }
    if (config?.showRounds && e.circuit.rounds != null) {
      parts.push(`${config.roundsLabel} ${e.circuit.rounds}라운드`);
    }
    if (e.circuit.workout) parts.push(e.circuit.workout);
    return parts.length > 0 ? `${typeLabel} — ${parts.join(" · ")}` : typeLabel;
  }

  const groups =
    e.groups
      .map((g) => {
        const parts: string[] = [];
        if (g.weight != null) parts.push(isNumericText(g.weight) ? `${g.weight}kg` : g.weight);
        if (g.reps != null) parts.push(isNumericText(g.reps) ? `${g.reps}회` : g.reps);
        if (g.sets != null) parts.push(`${g.sets}set`);
        return parts.join(" ");
      })
      .filter((s) => s.length > 0)
      .join(", ") || "-";
  // "기타"는 도구를 특정하지 않는 선택지라, 운동 이름 앞에 "(기타)"를 붙이지 않고
  // 이름만 그대로 보여준다.
  const namePart =
    e.equipment === "other" ? e.name : `(${PT_LOG_EQUIPMENT_LABELS[e.equipment] ?? e.equipment})${e.name}`;
  return `${namePart} — ${groups}`;
}

export function PtLogList({
  ptLogs,
  editable = true,
  emptyLabel = "아직 작성된 PT 일지가 없어요.",
  showDone = false,
  editHrefBase,
  deleteEndpointBase = "/api/admin/pt-logs",
  deleteConfirmMessage = "이 PT 일지를 삭제할까요? 되돌릴 수 없어요.",
}: {
  ptLogs: PtLogListRow[];
  editable?: boolean;
  emptyLabel?: string;
  /** true면 각 운동 앞에 완료 체크(☑/☐)를 보여준다 — 개인 운동 목록에서만 켠다. */
  showDone?: boolean;
  /** 예: "/admin/members/5/personal-exercise" → 실제 수정 링크는
      "{editHrefBase}/{log.id}/edit". 생략하면 PT 일지 관리자 기본 경로를 쓴다.
      (서버 컴포넌트에서 함수 prop을 client 컴포넌트로 못 넘기므로 문자열로 받는다.) */
  editHrefBase?: string;
  /** 예: "/api/admin/personal-exercises" → 실제 삭제 요청은
      "{deleteEndpointBase}/{log.id}". */
  deleteEndpointBase?: string;
  deleteConfirmMessage?: string;
}) {
  const router = useRouter();
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
        {emptyLabel}
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
          {monthLabel(selectedMonth)}에는 기록이 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log) => {
            const editHref = `${editHrefBase ?? `/admin/members/${log.member_id}/pt-log`}/${log.id}/edit`;
            const deleteEndpoint = `${deleteEndpointBase}/${log.id}`;
            return (
            <li
              key={log.id}
              onClick={editable ? () => router.push(editHref) : undefined}
              className={[
                "rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4",
                editable ? "cursor-pointer hover:border-coral/40 transition" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{log.log_date || formatDateTime(log.created_at)}</p>
                  {(log.pain_scale != null || log.memo) && (
                    <p className="text-xs text-ink/50 mt-0.5">
                      {log.pain_scale != null && `통증 ${log.pain_scale}/10`}
                      {log.pain_scale != null && log.memo && " · "}
                      {log.memo}
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <Link
                      href={editHref}
                      prefetch={false}
                      className="rounded-full border border-line px-3 py-1 text-ink/50 hover:border-coral hover:text-coral transition"
                    >
                      수정
                    </Link>
                    <DeletePtLogButton
                      ptLogId={log.id}
                      endpoint={deleteEndpoint}
                      confirmMessage={deleteConfirmMessage}
                      className="rounded-full border border-line px-3 py-1 text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
              {log.exercises.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line/50 space-y-1.5 text-sm text-ink/70">
                  {log.exercises.map((e, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {showDone && (
                        <span className={e.done ? "text-sage" : "text-ink/25"} aria-hidden>
                          {e.done ? "☑" : "☐"}
                        </span>
                      )}
                      <div>
                        <p>{exerciseSummary(e)}</p>
                        {e.note && <p className="text-xs text-ink/45 mt-0.5">특이사항 · {e.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
