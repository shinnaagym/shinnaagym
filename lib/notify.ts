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
    await fetch(endpoint, {
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
  } catch (err) {
    console.error("Formspree 알림 전송 실패:", err);
  }
}
