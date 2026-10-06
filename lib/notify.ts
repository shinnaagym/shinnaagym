import { PURPOSE_LABELS } from "./constants";

export interface ReservationNotification {
  name: string;
  age: number;
  phone: string;
  purposes: string[];
  purposeNote: string;
  date: string;
  hour: number;
}

// 예약이 들어올 때마다 Formspree로 알림을 보낸다. FORMSPREE_ENDPOINT가
// 설정되지 않았거나 전송이 실패해도 예약 자체는 정상 처리되어야 하므로
// 에러를 삼키고 로그만 남긴다.
export async function notifyNewReservation(data: ReservationNotification): Promise<void> {
  const endpoint = process.env.FORMSPREE_ENDPOINT;
  if (!endpoint) return;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: `[신나아짐] 새 예약 - ${data.date} ${data.hour}:00 ${data.name}`,
        성함: data.name,
        나이: data.age,
        연락처: data.phone,
        운동목적: data.purposes.map((p) => PURPOSE_LABELS[p] ?? p).join(", "),
        설명: data.purposeNote || "-",
        예약일시: `${data.date} ${data.hour}:00 - ${data.hour + 1}:00`,
      }),
    });
    // fetch는 429(요청 한도 초과)·410(폼 삭제/중지) 같은 HTTP 에러 상태에도 예외를
    // 던지지 않고 그냥 응답을 반환한다. res.ok를 확인하지 않으면 Formspree가
    // 거부해도 "성공"으로 착각해 아무 로그도 안 남고 메일만 조용히 안 가는
    // 상황이 생긴다 — 응답 본문까지 로그에 남겨 Vercel 로그에서 바로 원인을
    // 알 수 있게 한다.
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Formspree 알림 전송 실패: ${res.status} ${res.statusText} — ${body}`);
    }
  } catch (err) {
    console.error("Formspree 알림 전송 실패:", err);
  }
}
