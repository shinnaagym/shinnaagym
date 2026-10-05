"use client";

import { useState } from "react";

/** 솔라피(SMS) 연동이 끝난 뒤, 실제 수업 리마인드를 건드리지 않고 설정이
    맞는지 바로 확인해볼 수 있는 테스트 발송 도구. */
export function SmsTest() {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send() {
    if (!phone.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "발송에 실패했어요." });
        return;
      }
      setResult({ ok: true, message: "발송 요청에 성공했어요. 문자가 도착했는지 확인해보세요." });
    } catch {
      setResult({ ok: false, message: "네트워크 오류가 발생했어요." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
      <h2 className="font-display text-lg mb-1">문자 발송 테스트</h2>
      <p className="text-xs text-ink/50 mb-4">
        솔라피(SOLAPI_API_KEY·SOLAPI_API_SECRET·SOLAPI_SENDER_PHONE) 설정이 제대로 됐는지
        회원 리마인드와 무관하게 확인해볼 수 있어요. 번호를 입력하고 보내보세요.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="받는 사람 번호 (예: 010-1234-5678)"
          className="flex-1 rounded-lg border border-line px-3.5 py-2.5 text-sm outline-none focus:border-coral"
        />
        <button
          onClick={send}
          disabled={sending || !phone.trim()}
          className="shrink-0 rounded-full bg-ink text-white px-5 py-2.5 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {sending ? "발송 중..." : "테스트 문자 보내기"}
        </button>
      </div>
      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-sage" : "text-coral"}`}>{result.message}</p>
      )}
    </section>
  );
}
