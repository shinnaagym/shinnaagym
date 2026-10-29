import { addDaysToKey, weekdayLabelForDateKey } from "@/lib/date";
import type { SessionWithMember } from "@/lib/schedule";
import type { SessionStatus } from "@/lib/db";

const STATUS_LABEL: Record<SessionStatus, string> = {
  reserved: "예약",
  no_show: "노쇼",
  cancelled: "취소",
  done: "완료",
};

function formatTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function entryLabel(session: SessionWithMember): string {
  if (session.entry_type === "memo") return `📝 ${session.memo || "메모"}`;
  if (session.entry_type === "blocked") return `🚫 ${session.memo || "수업 불가"}`;
  if (session.entry_type === "consultation") return `💬 상담 · ${session.member_name ?? "-"}`;
  const pairIcon = session.pt_type === "2:1" ? "👥 " : "";
  return `${pairIcon}${session.member_name ?? "-"}`;
}

/** PT 일지를 쓰면서 그 회원을 담당하는 코치의 이번 주 스케줄을 바로 확인할 수
    있도록 폼 맨 아래에 보여준다. 다른 코치의 일정은 섞이지 않고, 그 코치의
    일정만 보인다. */
export function CoachWeekSchedule({
  coachName,
  weekStart,
  sessions,
}: {
  coachName: string;
  weekStart: string;
  sessions: SessionWithMember[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const byDate = new Map<string, SessionWithMember[]>();
  for (const s of sessions) {
    if (!byDate.has(s.session_date)) byDate.set(s.session_date, []);
    byDate.get(s.session_date)!.push(s);
  }

  return (
    <div className="rounded-2xl border border-line bg-white/60 px-5 py-4 mb-4">
      <p className="font-display text-lg mb-3">📅 {coachName} 코치님 이번 주 스케줄</p>
      {sessions.length === 0 ? (
        <p className="text-sm text-ink/50">이번 주 일정이 없어요.</p>
      ) : (
        <div className="space-y-3">
          {days.map((date) => {
            const daySessions = byDate.get(date);
            if (!daySessions || daySessions.length === 0) return null;
            return (
              <div key={date}>
                <p className="text-xs font-medium text-ink/50 mb-1">
                  {date.slice(5).replace("-", "/")} ({weekdayLabelForDateKey(date)})
                </p>
                <ul className="space-y-1">
                  {daySessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span>
                        {formatTime(s.session_hour, s.session_minute)} · {entryLabel(s)}
                      </span>
                      {(s.status === "cancelled" || s.status === "no_show") && (
                        <span className="text-xs text-ink/40">{STATUS_LABEL[s.status]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
