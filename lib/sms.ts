import { createHmac, randomBytes } from "crypto";

// 솔라피(Solapi) REST API로 문자(SMS)를 보낸다. SOLAPI_API_KEY/SOLAPI_API_SECRET/
// SOLAPI_SENDER_PHONE 중 하나라도 설정되지 않았으면 발송을 건너뛴다 — 로컬
// 개발 환경이나 아직 솔라피 연동 전인 배포에서도 나머지 기능은 정상 동작해야
// 하므로, 여기서 에러를 던지지 않고 false만 반환한다(lib/notify.ts의
// notifyNewReservation과 동일한 "설정 없으면 조용히 건너뛰기" 패턴).
function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/** 하이픈·공백을 지우고 숫자만 남긴다 — 솔라피는 "01012345678" 형식을 쓴다. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_SENDER_PHONE;
  if (!apiKey || !apiSecret || !from) return false;

  const toDigits = normalizePhone(to);
  if (!toDigits) return false;

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(apiKey, apiSecret),
      },
      body: JSON.stringify({
        message: {
          to: toDigits,
          from: normalizePhone(from),
          text,
        },
      }),
    });
    if (!res.ok) {
      console.error("솔라피 문자 발송 실패:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("솔라피 문자 발송 실패:", err);
    return false;
  }
}
