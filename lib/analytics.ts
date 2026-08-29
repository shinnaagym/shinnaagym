// Google Analytics(GA4) 헬퍼. NEXT_PUBLIC_GA_ID가 설정된 경우에만(주로
// 운영 배포에서만) 실제로 이벤트를 보내고, 그 외에는 조용히 아무 것도
// 하지 않는다 — 로컬 개발이나 프리뷰 배포에서 실제 GA 속성에 잡음이
// 섞이지 않게 하기 위함이다.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** 사전예약 퍼널 이벤트를 GA4로 보낸다. gtag가 아직 로드되지 않았거나
    GA가 꺼져있는 환경(로컬/프리뷰)에서는 아무 것도 하지 않는다. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}
