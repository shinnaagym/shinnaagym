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

export interface SendSmsResult {
  ok: boolean;
  /** 실패 이유 — 관리자용 테스트 발송 화면에서 "뭐가 문제인지" 바로 보여주기 위함.
      호출부에서 사용자에게 그대로 노출해도 괜찮은 수준의 메시지만 담는다. */
  error?: string;
}

export async function sendSms(to: string, text: string): Promise<SendSmsResult> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_SENDER_PHONE;
  if (!apiKey || !apiSecret || !from) {
    return { ok: false, error: "SOLAPI_API_KEY/SOLAPI_API_SECRET/SOLAPI_SENDER_PHONE 환경 변수가 설정되지 않았어요." };
  }

  const toDigits = normalizePhone(to);
  if (!toDigits) {
    return { ok: false, error: "받는 사람 전화번호가 올바르지 않아요." };
  }

  // 90바이트를 넘으면 솔라피가 장문(LMS)으로 자동 전환해 보내는데, 제목(subject)을
  // 안 넘기면 본문 앞부분을 잘라 만든 제목이 "[Web발신]" 표시 없이 먼저 붙고, 그
  // 뒤에 "[Web발신]"과 함께 본문 전체가 다시 와서 — 문자가 앞부분이 잘린 채 한 번,
  // 전체가 또 한 번, 총 두 번 겹쳐 오는 것처럼 보이는 문제가 있었다. 장문일 때만
  // 짧은 제목을 직접 지정해 이 자동 생성을 막는다.
  const isLong = Buffer.byteLength(text, "utf8") > 90;

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
          ...(isLong ? { subject: "신나아짐", autoTypeDetect: true } : {}),
        },
      }),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("솔라피 문자 발송 실패:", res.status, body);
      let reason = body;
      try {
        const parsed = JSON.parse(body) as { errorMessage?: string; message?: string };
        reason = parsed.errorMessage ?? parsed.message ?? body;
      } catch {
        // body가 JSON이 아니면 그대로 둠
      }
      return { ok: false, error: `솔라피 오류(${res.status}): ${reason}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("솔라피 문자 발송 실패:", err);
    return { ok: false, error: err instanceof Error ? err.message : "네트워크 오류가 발생했어요." };
  }
}
