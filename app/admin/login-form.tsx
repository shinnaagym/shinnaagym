"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface RecaptchaWidget {
  render(
    container: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      size?: "normal" | "compact";
    },
  ): number;
  reset(widgetId?: number): void;
}

declare global {
  interface Window {
    grecaptcha?: RecaptchaWidget;
    onRecaptchaApiLoad?: () => void;
  }
}

// 구글 리캡챠 스크립트는 <script> 태그 자체의 load 이벤트(next/script의
// onLoad/onReady)가 발생해도 window.grecaptcha.render가 아직 쓸 준비가 안 돼
// 있을 때가 있다 — 구글이 공식적으로 권장하는 방식은 스크립트 URL에
// ?onload=콜백이름을 붙여서, 구글 내부적으로 정말 준비된 시점에 그 콜백을
// 직접 불러주는 것이다. 이 콜백 이름은 스크립트가 로드되기 전에 미리
// window에 등록돼 있어야 하므로, 컴포넌트 useEffect보다 먼저(모듈이
// 평가되는 시점) 등록해둔다 — 실제 렌더 로직은 아래 registeredRenderFn에
// 위임해서, 여러 인스턴스가 떠도 항상 "현재 마운트된" 컴포넌트를 부른다.
let registeredRenderFn: (() => void) | null = null;
if (typeof window !== "undefined") {
  window.onRecaptchaApiLoad = () => registeredRenderFn?.();
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
      size: "compact",
    });
  }, [recaptchaSiteKey]);

  useEffect(() => {
    registeredRenderFn = renderRecaptcha;
    // 컴포넌트가 마운트되기 전에(예: 뒤로가기로 캐시된 페이지 복귀) 스크립트가
    // 이미 로드돼있던 경우, 구글의 onload 콜백이 다시 오지 않으므로 여기서
    // 직접 한 번 시도한다.
    if (window.grecaptcha) renderRecaptcha();
    return () => {
      registeredRenderFn = null;
    };
  }, [renderRecaptcha]);

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
      <Script src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaApiLoad&render=explicit" strategy="afterInteractive" />
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
        <div ref={recaptchaContainerRef} className="flex justify-center" />
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
