const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// 구글이 공식 문서(https://developers.google.com/recaptcha/docs/faq)에서
// "테스트용으로 아무 도메인에서나 항상 통과한다"고 명시한 키다. 로컬 개발 시
// 실제 키 발급 없이도 화면·흐름을 그대로 테스트할 수 있도록 기본값으로 쓴다.
// ⚠️ 운영 배포에서는 반드시 Vercel 환경변수(NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
// RECAPTCHA_SECRET_KEY)로 실제 키를 넣어야 한다 — 이 테스트 키가 그대로
// 배포되면 리캡챠가 항상 통과하는 것과 같아서 브루트포스 방어 효과가 없다.
const TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const TEST_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

export function getRecaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || TEST_SITE_KEY;
}

interface RecaptchaVerifyResponse {
  success: boolean;
}

export async function verifyRecaptcha(token: unknown, remoteIp: string): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  const secret = process.env.RECAPTCHA_SECRET_KEY || TEST_SECRET_KEY;

  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as RecaptchaVerifyResponse;
    return data.success === true;
  } catch {
    // 구글 쪽 네트워크 오류로 검증 자체가 실패하면 로그인을 거절한다 — IP
    // 레이트리밋이 별도로 걸려있어 재시도가 무한 악용으로 이어지진 않는다.
    return false;
  }
}
