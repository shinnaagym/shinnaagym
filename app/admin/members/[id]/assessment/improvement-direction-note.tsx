"use client";

import { useState } from "react";

/** 이 회원의 치료/트레이닝 방향을 자유롭게 적어두는 메모장 — 회원마다 하나씩, 최신 내용만 저장된다. */
export function ImprovementDirectionNote({
  memberId,
  initialValue,
}: {
  memberId: number;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== savedValue;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ improvementDirection: value }),
      });
      if (!res.ok) {
        setError("저장에 실패했어요.");
        return;
      }
      setSavedValue(value);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line/60 bg-white shadow-sm px-5 py-4 mb-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="font-display text-base">나아지는 방향 (DP)</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="shrink-0 rounded-full bg-ink text-white px-4 py-1.5 text-sm hover:bg-coral transition disabled:opacity-40"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="이 회원의 치료·트레이닝 방향을 메모해두세요."
        rows={4}
        className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-coral resize-y"
      />
      {error && <p className="text-sm text-coral mt-1.5">{error}</p>}
    </div>
  );
}
