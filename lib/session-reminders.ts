import { query } from "./db";
import { addDaysToKey, koreaTodayKey } from "./date";
import { STUDIO_PHONE } from "./constants";
import { sendSms } from "./sms";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function weekdayLabelForDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAY_LABELS[(dt.getUTCDay() + 6) % 7];
}

interface ReminderTarget {
  id: number;
  memberName: string;
  memberPhone: string;
  sessionDate: string;
  sessionHour: number;
  sessionMinute: number;
}

/** 내일 날짜의 PT 수업(entry_type='session', status='reserved') 중 아직 리마인드
    문자를 안 보낸 건을 전화번호와 함께 가져온다. 전화번호가 비어있는 회원은
    보낼 곳이 없으니 제외한다. */
async function getTomorrowPtSessionsNeedingReminder(): Promise<ReminderTarget[]> {
  const tomorrow = addDaysToKey(koreaTodayKey(), 1);
  const { rows } = await query<{
    id: number;
    member_name: string;
    member_phone: string;
    session_date: string;
    session_hour: number;
    session_minute: number;
  }>(
    `SELECT s.id, m.name AS member_name, m.phone AS member_phone,
            s.session_date, s.session_hour, s.session_minute
     FROM class_sessions s
     JOIN members m ON m.id = s.member_id
     WHERE s.session_date = $1
       AND s.entry_type = 'session'
       AND s.status = 'reserved'
       AND s.reminder_sent_at IS NULL
       AND m.phone <> ''`,
    [tomorrow],
  );
  return rows.map((r) => ({
    id: r.id,
    memberName: r.member_name,
    memberPhone: r.member_phone,
    sessionDate: r.session_date,
    sessionHour: r.session_hour,
    sessionMinute: r.session_minute,
  }));
}

function formatHourMinute(hour: number, minute: number): string {
  return minute > 0 ? `${hour}시${minute}분` : `${hour}시`;
}

// SMS(단문)는 90바이트(EUC-KR 기준, 한글 1자=2바이트)를 넘으면 자동으로 더
// 비싼 LMS로 바뀐다. 회원 이름이 길고(4자) 분(分)까지 있는 최악의 경우에도
// 90바이트를 넘지 않도록 문구를 짧게 유지한다(실측 최대 약 74바이트).
function buildReminderMessage(target: ReminderTarget): string {
  const [, month, day] = target.sessionDate.split("-").map(Number);
  const weekday = weekdayLabelForDateKey(target.sessionDate);
  const time = formatHourMinute(target.sessionHour, target.sessionMinute);
  return `[신나아짐] ${target.memberName}님, 내일 ${month}/${day}(${weekday}) ${time} PT예약 변경은 ${STUDIO_PHONE}`;
}

async function markReminderSent(sessionId: number): Promise<void> {
  await query(`UPDATE class_sessions SET reminder_sent_at = now() WHERE id = $1`, [sessionId]);
}

export interface SendReminderSummary {
  total: number;
  sent: number;
  failed: number;
}

/** 내일 PT 수업이 있는 회원 전원에게 리마인드 문자를 보낸다. 솔라피 설정이
    안 되어 있으면 sendSms가 매번 false를 반환해, total은 그대로이고
    sent=0으로 끝난다(에러를 던지지 않음 — 크론 자체는 실패로 안 남게). */
export async function sendTomorrowSessionReminders(): Promise<SendReminderSummary> {
  const targets = await getTomorrowPtSessionsNeedingReminder();
  let sent = 0;
  for (const target of targets) {
    const ok = await sendSms(target.memberPhone, buildReminderMessage(target));
    if (ok) {
      await markReminderSent(target.id);
      sent += 1;
    }
  }
  return { total: targets.length, sent, failed: targets.length - sent };
}
