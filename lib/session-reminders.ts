import { query } from "./db";
import type { SessionEntryType } from "./db";
import { addDaysToKey, formatAmPmHourMinute, formatHourMinute, koreaTodayKey, weekdayLabelForDateKey } from "./date";
import { STUDIO_PHONE } from "./constants";
import { sendSms } from "./sms";
import { renderSmsTemplate, type SmsTemplateKey } from "./sms-templates";
import { getSmsTemplates } from "./sms-templates-store";

interface ReminderTarget {
  id: number;
  entryType: SessionEntryType;
  memberName: string;
  memberPhone: string;
  coachName: string;
  coachPhone: string;
  sessionDate: string;
  sessionHour: number;
  sessionMinute: number;
}

/** 내일 날짜의 PT 수업·상담(entry_type='session'|'consultation', status='reserved')
    중 아직 리마인드 문자를 안 보낸 건을 회원·담당 코치 전화번호와 함께 가져온다.
    코치가 여러 명으로 늘어도 문자에 "담당 코치"를 바로 보여줄 수 있도록 담당
    코치 연락처를 함께 조회한다. 회원 전화번호가 비어있으면 보낼 곳이 없으니
    제외한다. */
async function getTomorrowReminderTargets(): Promise<ReminderTarget[]> {
  const tomorrow = addDaysToKey(koreaTodayKey(), 1);
  const { rows } = await query<{
    id: number;
    entry_type: SessionEntryType;
    member_name: string;
    member_phone: string;
    coach_name: string;
    coach_phone: string;
    session_date: string;
    session_hour: number;
    session_minute: number;
  }>(
    `SELECT s.id, s.entry_type, m.name AS member_name, m.phone AS member_phone,
            c.name AS coach_name, c.phone AS coach_phone,
            s.session_date, s.session_hour, s.session_minute
     FROM class_sessions s
     JOIN members m ON m.id = s.member_id
     JOIN coaches c ON c.id = s.coach_id
     WHERE s.session_date = $1
       AND s.entry_type IN ('session', 'consultation')
       AND s.status = 'reserved'
       AND s.reminder_sent_at IS NULL
       AND m.phone <> ''`,
    [tomorrow],
  );
  return rows.map((r) => ({
    id: r.id,
    entryType: r.entry_type,
    memberName: r.member_name,
    memberPhone: r.member_phone,
    coachName: r.coach_name,
    coachPhone: r.coach_phone,
    sessionDate: r.session_date,
    sessionHour: r.session_hour,
    sessionMinute: r.session_minute,
  }));
}

// SMS(단문)는 90바이트(lib/sms.ts가 실제로 판단하는 기준은 UTF-8, 한글
// 1자=3바이트)를 넘으면 자동으로 더 비싼 LMS로 바뀐다. 설정 화면에서 문구를
// 직접 고칠 수 있게 되면서 이 길이 제약은 더 이상 코드가 강제할 수 없고,
// 설정 화면의 안내 문구로만 알려준다.
function buildSessionReminderMessage(target: ReminderTarget, template: string): string {
  const [, month, day] = target.sessionDate.split("-").map(Number);
  const weekday = weekdayLabelForDateKey(target.sessionDate);
  const time = formatHourMinute(target.sessionHour, target.sessionMinute);
  const coachPhone = target.coachPhone.trim() || STUDIO_PHONE;
  return renderSmsTemplate(template, {
    이름: target.memberName,
    월: String(month),
    일: String(day),
    요일: weekday,
    시간: time,
    코치: target.coachName,
    코치전화: coachPhone,
  });
}

function buildConsultationReminderMessage(target: ReminderTarget, template: string): string {
  const [, month, day] = target.sessionDate.split("-").map(Number);
  const weekday = weekdayLabelForDateKey(target.sessionDate);
  const time = formatAmPmHourMinute(target.sessionHour, target.sessionMinute);
  return renderSmsTemplate(template, {
    이름: target.memberName,
    월: String(month),
    일: String(day),
    요일: weekday,
    시간: time,
  });
}

function buildReminderMessage(target: ReminderTarget, templates: Record<SmsTemplateKey, string>): string {
  return target.entryType === "consultation"
    ? buildConsultationReminderMessage(target, templates.consultation_reminder)
    : buildSessionReminderMessage(target, templates.session_reminder);
}

async function markReminderSent(sessionId: number): Promise<void> {
  await query(`UPDATE class_sessions SET reminder_sent_at = now() WHERE id = $1`, [sessionId]);
}

export interface SendReminderSummary {
  total: number;
  sent: number;
  failed: number;
}

/** 내일 PT 수업·상담이 있는 회원 전원에게 리마인드 문자를 보낸다. 솔라피
    설정이 안 되어 있으면 sendSms가 매번 실패를 반환해, total은 그대로이고
    sent=0으로 끝난다(에러를 던지지 않음 — 크론 자체는 실패로 안 남게). */
export async function sendTomorrowSessionReminders(): Promise<SendReminderSummary> {
  const [targets, templates] = await Promise.all([getTomorrowReminderTargets(), getSmsTemplates()]);
  let sent = 0;
  for (const target of targets) {
    const result = await sendSms(target.memberPhone, buildReminderMessage(target, templates));
    if (result.ok) {
      await markReminderSent(target.id);
      sent += 1;
    }
  }
  return { total: targets.length, sent, failed: targets.length - sent };
}
