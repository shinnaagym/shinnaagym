"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface RecaptchaWidget {
  render(
    container: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ): number;
  reset(widgetId?: number): void;
}

declare global {
  interface Window {
    grecaptcha?: RecaptchaWidget;
  }
}

export function LoginForm({ recaptchaSiteKey }: { recaptchaSiteKey: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  const renderRecaptcha = useCallback(() => {
    if (!window.grecaptcha || !recaptchaContainerRef.current || widgetIdRef.current !== null) return;
    widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
      sitekey: recaptchaSiteKey,
      callback: (token) => setRecaptchaToken(token),
      "expired-callback": () => setRecaptchaToken(null),
    });
  }, [recaptchaSiteKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!recaptchaToken) {
      setError("로봇이 아님을 확인해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, recaptchaToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "비밀번호가 올바르지 않아요.");
        return;
      }
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      // 리캡챠 토큰은 한 번만 쓸 수 있으므로, 성공하든 실패하든 다음 시도를
      // 위해 위젯을 초기화한다.
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
      setRecaptchaToken(null);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" onReady={renderRecaptcha} />
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">관리자 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral"
          />
        </div>
        <div ref={recaptchaContainerRef} />
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
          {submitting ? "확인 중..." : "로그인"}
        </button>
      </form>
    </>
  );
}
