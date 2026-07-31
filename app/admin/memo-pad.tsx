"use client";

import { useState } from "react";
import type { ScheduleMemoRow } from "@/lib/db";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** 특정 화면 전용의 공용 메모장 — 여러 메모를 누적해서 쓸 수 있다. addUrl/idToDeleteUrl로
    어느 메모 목록(스케줄표/설정 등)을 다룰지 지정한다. */
export function MemoPad({
  title,
  initialMemos,
  addUrl,
  idToDeleteUrl,
}: {
  title: string;
  initialMemos: ScheduleMemoRow[];
  addUrl: string;
  idToDeleteUrl: (id: number) => string;
}) {
  const [memos, setMemos] = useState(initialMemos);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addMemo() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(addUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "메모 추가에 실패했어요.");
        return;
      }
      setMemos((prev) => [data.memo, ...prev]);
      setContent("");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMemo(id: number) {
    setMemos((prev) => prev.filter((m) => m.id !== id));
    await fetch(idToDeleteUrl(id), { method: "DELETE" });
  }

  return (
    <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4">
      <p className="font-display text-base mb-3">{title}</p>
      <div className="flex gap-2 mb-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addMemo();
          }}
          placeholder="메모를 남겨주세요"
          className="flex-1 min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
        />
        <button
          type="button"
          onClick={addMemo}
          disabled={submitting}
          className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-coral mb-2">{error}</p>}

      {memos.length === 0 ? (
        <p className="text-sm text-ink/40 py-2">아직 메모가 없어요.</p>
      ) : (
        <div className="divide-y divide-line/50 max-h-72 overflow-y-auto">
          {memos.map((memo) => (
            <div key={memo.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm whitespace-pre-wrap break-words">{memo.content}</p>
                <p className="text-[11px] text-ink/35 mt-0.5">{formatDateTime(memo.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeMemo(memo.id)}
                className="shrink-0 text-xs text-red-400 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
