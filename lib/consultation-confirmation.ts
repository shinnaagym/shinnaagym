import { sendSms } from "./sms";
import { formatAmPmHourMinute, weekdayLabelForDateKey } from "./date";
import { renderSmsTemplate } from "./sms-templates";
import { getSmsTemplates } from "./sms-templates-store";

/** 상담 예약이 막 등록됐을 때 바로 보내는 안내 문자. 전날 보내는 리마인드
    (session-reminders.ts)와는 별개로, 예약 생성 직후 딱 한 번만 보낸다.
    문구는 설정 화면에서 고칠 수 있어(lib/sms-templates-store.ts) 매번 DB에서
    최신 템플릿을 읽어온다. */
export async function buildConsultationConfirmationMessage({
  memberName,
  date,
  hour,
  minute = 0,
}: {
  memberName: string;
  date: string;
  hour: number;
  minute?: number;
}): Promise<string> {
  const [, month, day] = date.split("-").map(Number);
  const weekday = weekdayLabelForDateKey(date);
  const time = formatAmPmHourMinute(hour, minute);
  const templates = await getSmsTemplates();
  return renderSmsTemplate(templates.consultation_confirmation, {
    이름: memberName,
    월: String(month),
    일: String(day),
    요일: weekday,
    시간: time,
  });
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
  const message = await buildConsultationConfirmationMessage(params);
  await sendSms(params.phone, message);
}
