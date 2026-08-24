"use client";

import { useState, type FormEvent } from "react";

export function LedgerGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ledger-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "확인에 실패했습니다.");
        return;
      }
      onUnlock();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xs px-6 py-20">
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-1">Ledger</p>
      <h1 className="font-display text-2xl mb-2">가계부</h1>
      <p className="text-sm text-ink/50 mb-6">
        대표 전용 화면이에요. 비밀번호를 한 번 더 확인할게요.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          placeholder="2차 비밀번호"
          className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral"
        />
        {error && (
          <p className="text-sm text-coral font-medium" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink text-bone py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "확인 중..." : "확인"}
        </button>
      </form>
    </div>
  );
}
