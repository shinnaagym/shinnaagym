import { sendSms } from "./sms";
import { formatAmPmHourMinute, weekdayLabelForDateKey } from "./date";

/** 상담 예약이 막 등록됐을 때 바로 보내는 안내 문자. 전날 보내는 리마인드
    (session-reminders.ts)와는 별개로, 예약 생성 직후 딱 한 번만 보낸다. */
export function buildConsultationConfirmationMessage({
  memberName,
  date,
  hour,
  minute = 0,
}: {
  memberName: string;
  date: string;
  hour: number;
  minute?: number;
}): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = weekdayLabelForDateKey(date);
  const time = formatAmPmHourMinute(hour, minute);
  return `[신나아짐] ${memberName}님, 상담 신청해 주셔서 감사합니다 😊
예약 내용 확인 부탁드려요.

📅 일시: ${month}월 ${day}일(${weekday}) ${time}
📍 장소: 청주시 흥덕구 서현로 32 가경자이프라자 2층 신나아짐
🚗 주차: 상가 내 지하주차장, 상가 옆 무료 공영주차장


상담은 약 30분~50분 동안 현재 몸 상태와 움직임을 확인하고, ${memberName}님께 맞는 운동 방향을 함께 정하는 시간이에요. 편한 운동복 준비해 주세요.

상담 전날 안내 문자 다시 보내겠습니다.
일정 변경이 필요하시면 이 번호로 편하게 연락 주세요!`;
}

/** 전화번호가 비어있거나 솔라피 설정이 안 돼 있으면 sendSms가 조용히 실패를
    반환하므로(절대 throw하지 않음), 호출부는 예약 생성 흐름을 막지 않고 그냥
    이어서 불러도 된다. */
export async function sendConsultationConfirmationSms(params: {
  memberName: string;
  phone: string;
  date: string;
  hour: number;
  minute?: number;
}): Promise<void> {
  if (!params.phone.trim()) return;
  await sendSms(params.phone, buildConsultationConfirmationMessage(params));
}
