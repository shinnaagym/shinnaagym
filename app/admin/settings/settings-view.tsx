"use client";

import { useState } from "react";
import type {
  AdminDeviceRow,
  CoachRow,
  EmploymentType,
  HolidayRow,
  RecurringEventCycle,
  RecurringEventRow,
  SettingsMemoRow,
} from "@/lib/db";
import { SyncDiagnostics } from "./sync-diagnostics";
import { MemoPad } from "../memo-pad";

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0~24시(종료 시각용 24 포함)

// lib/recurring-events.ts는 서버 전용 DB 클라이언트(pg)를 물고 있어 클라이언트
// 컴포넌트에서 import하면 번들이 깨지므로, 라벨만 이 파일에 그대로 복제해 둔다.
const CYCLE_LABELS: Record<RecurringEventCycle, string> = {
  monthly: "매달",
  quarterly: "분기(3·6·9·12월)",
};

const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: "정직원",
  freelancer: "프리랜서",
  team_lead: "팀장",
  owner: "대표",
};

// weekday: 앱 전체에서 쓰는 관례대로 0=월요일 ~ 6=일요일.
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export type DutyRoster = Record<number, { coachId: number; coachName: string }>;

export function SettingsView({
  initialCoaches,
  initialHolidays,
  memberCounts,
  buildId,
  initialDevices,
  currentDeviceId,
  initialDutyRoster,
  initialRecurringEvents,
  initialSettingsMemos,
}: {
  initialCoaches: CoachRow[];
  initialHolidays: HolidayRow[];
  memberCounts: Record<number, number>;
  buildId: string;
  initialDevices: AdminDeviceRow[];
  currentDeviceId: string | null;
  initialDutyRoster: DutyRoster;
  initialRecurringEvents: RecurringEventRow[];
  initialSettingsMemos: SettingsMemoRow[];
}) {
  const [coaches, setCoaches] = useState(initialCoaches);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [dutyRoster, setDutyRoster] = useState(initialDutyRoster);
  const [newCoachName, setNewCoachName] = useState("");
  const [newCoachPhone, setNewCoachPhone] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [recurringEvents, setRecurringEvents] = useState(initialRecurringEvents);
  const [newEventName, setNewEventName] = useState("");
  const [newEventCycle, setNewEventCycle] = useState<RecurringEventCycle>("monthly");
  const [newEventDay, setNewEventDay] = useState(1);
  const [newEventStartHour, setNewEventStartHour] = useState(12);
  const [newEventEndHour, setNewEventEndHour] = useState(14);
  const [error, setError] = useState<string | null>(null);

  async function toggleDuty(weekday: number, coach: CoachRow) {
    const isAssignedToThisCoach = dutyRoster[weekday]?.coachId === coach.id;
    const nextCoachId = isAssignedToThisCoach ? null : coach.id;
    setDutyRoster((prev) => {
      const next = { ...prev };
      if (nextCoachId === null) delete next[weekday];
      else next[weekday] = { coachId: coach.id, coachName: coach.name };
      return next;
    });
    await fetch("/api/admin/duty-roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekday, coachId: nextCoachId }),
    });
  }

  async function addCoach() {
    if (!newCoachName.trim()) return;
    setError(null);
    const res = await fetch("/api/admin/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCoachName.trim(), phone: newCoachPhone.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "코치 등록에 실패했습니다.");
      return;
    }
    setCoaches((prev) => [...prev, data.coach]);
    setNewCoachName("");
    setNewCoachPhone("");
  }

  async function updateCoachPhone(id: number, phone: string) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, phone } : c)));
    await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
  }

  async function updateCoachEmployment(
    id: number,
    patch: Partial<Pick<CoachRow, "employment_type" | "hired_at" | "is_team_lead">>,
  ) {
    setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await fetch(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employmentType: patch.employment_type,
        hiredAt: patch.hired_at,
        isTeamLead: patch.is_team_lead,
      }),
    });
  }

  async function toggleCoach(coach: CoachRow) {
    if (coach.active) {
      const activeMembers = memberCounts[coach.id] ?? 0;
      const confirmMessage =
        activeMembers > 0
          ? `${coach.name} 코치에게 배정된 활성 회원이 ${activeMembers}명 있어요. 퇴사 처리해도 회원 담당은 자동으로 바뀌지 않으니, 회원 관리에서 먼저 담당 코치를 변경하는 걸 추천해요. 그래도 퇴사 처리할까요?`
          : `${coach.name} 코치를 퇴사 처리할까요? 스케줄표에서 컬럼이 사라지고, 새 회원 등록 시 선택할 수 없게 돼요.`;
      if (!confirm(confirmMessage)) return;
    }
    await fetch(`/api/admin/coaches/${coach.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coach.active }),
    });
    setCoaches((prev) =>
      prev.map((c) => (c.id === coach.id ? { ...c, active: !c.active } : c)),
    );
  }

  async function addHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) {
      setError("날짜와 이름을 모두 입력해주세요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newHolidayDate, name: newHolidayName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "공휴일 추가에 실패했습니다.");
      return;
    }
    setHolidays((prev) =>
      [...prev.filter((h) => h.holiday_date !== newHolidayDate), { holiday_date: newHolidayDate, name: newHolidayName.trim() }].sort(
        (a, b) => a.holiday_date.localeCompare(b.holiday_date),
      ),
    );
    setNewHolidayDate("");
    setNewHolidayName("");
  }

  async function removeHoliday(date: string) {
    await fetch(`/api/admin/holidays?date=${date}`, { method: "DELETE" });
    setHolidays((prev) => prev.filter((h) => h.holiday_date !== date));
  }

  async function addRecurringEvent() {
    if (!newEventName.trim()) {
      setError("정기 일정 이름을 입력해주세요.");
      return;
    }
    if (newEventStartHour >= newEventEndHour) {
      setError("종료 시각은 시작 시각보다 늦어야 해요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/recurring-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newEventName.trim(),
        cycle: newEventCycle,
        dayOfMonth: newEventDay,
        startHour: newEventStartHour,
        endHour: newEventEndHour,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "정기 일정 등록에 실패했습니다.");
      return;
    }
    setRecurringEvents((prev) => [...prev, data.event]);
    setNewEventName("");
    setNewEventCycle("monthly");
    setNewEventDay(1);
    setNewEventStartHour(12);
    setNewEventEndHour(14);
  }

  async function patchRecurringEvent(
    id: number,
    patch: Partial<{
      name: string;
      cycle: RecurringEventCycle;
      dayOfMonth: number;
      startHour: number;
      endHour: number;
      enabled: boolean;
    }>,
  ) {
    setRecurringEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(patch.name !== undefined && { name: patch.name }),
              ...(patch.cycle !== undefined && { cycle: patch.cycle }),
              ...(patch.dayOfMonth !== undefined && { day_of_month: patch.dayOfMonth }),
              ...(patch.startHour !== undefined && { start_hour: patch.startHour }),
              ...(patch.endHour !== undefined && { end_hour: patch.endHour }),
              ...(patch.enabled !== undefined && { enabled: patch.enabled }),
            }
          : e,
      ),
    );
    await fetch(`/api/admin/recurring-events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeRecurringEvent(id: number) {
    setRecurringEvents((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/admin/recurring-events/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <SyncDiagnostics
        buildId={buildId}
        initialDevices={initialDevices}
        currentDeviceId={currentDeviceId}
      />

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">코치 관리</h2>
        <p className="text-xs text-ink/50 mb-4">
          지금은 신종수 코치 1명이지만, 나중에 코치가 추가되면 여기서 등록해주세요. 등록하는
          즉시 스케줄표에 컬럼이 생깁니다.
        </p>
        <div className="divide-y divide-line/50">
          {coaches.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{c.name}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px]",
                      c.active ? "bg-sage/10 text-sage" : "bg-line/40 text-ink/40",
                    ].join(" ")}
                  >
                    {c.active ? "재직 중" : "퇴사함"}
                  </span>
                  {c.active && (memberCounts[c.id] ?? 0) > 0 && (
                    <span className="text-[11px] text-ink/40">
                      담당 {memberCounts[c.id]}명
                    </span>
                  )}
                  <input
                    defaultValue={c.phone}
                    placeholder="연락처 (예: 010-0000-0000)"
                    onBlur={(e) => updateCoachPhone(c.id, e.target.value.trim())}
                    className="w-40 rounded-lg border border-line px-2.5 py-1 text-xs outline-none focus:border-coral"
                  />
                </div>
                <button
                  onClick={() => toggleCoach(c)}
                  className={[
                    "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs border transition",
                    c.active
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-sage/50 text-sage hover:bg-sage/10",
                  ].join(" ")}
                >
                  {c.active ? "퇴사 처리" : "재직으로 전환"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-0.5">
                <span className="text-[11px] text-ink/40">급여 계산용</span>
                <select
                  value={c.employment_type}
                  onChange={(e) =>
                    updateCoachEmployment(c.id, {
                      employment_type: e.target.value as EmploymentType,
                    })
                  }
                  className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                >
                  {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((type) => (
                    <option key={type} value={type}>
                      {EMPLOYMENT_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  defaultValue={c.hired_at}
                  onChange={(e) => updateCoachEmployment(c.id, { hired_at: e.target.value })}
                  className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-coral"
                />
                {c.employment_type === "regular" && (
                  <label className="flex items-center gap-1 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={c.is_team_lead}
                      onChange={(e) =>
                        updateCoachEmployment(c.id, { is_team_lead: e.target.checked })
                      }
                    />
                    팀장
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            value={newCoachName}
            onChange={(e) => setNewCoachName(e.target.value)}
            placeholder="새 코치 이름"
            className="flex-1 min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <input
            value={newCoachPhone}
            onChange={(e) => setNewCoachPhone(e.target.value)}
            placeholder="연락처 (예: 010-0000-0000)"
            className="flex-1 min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <button
            onClick={addCoach}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">당직자 설정</h2>
        <p className="text-xs text-ink/50 mb-4">
          요일마다 당직 코치를 지정하면 스케줄표 요일 아래에 표시돼요. 한 요일에는 한 명만
          지정할 수 있어요(다른 코치를 선택하면 그 요일의 기존 지정은 해제돼요).
        </p>
        <div className="divide-y divide-line/50">
          {coaches
            .filter((c) => c.active)
            .map((c) => (
              <div key={c.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                <span className="text-sm w-16 shrink-0">{c.name}</span>
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAY_LABELS.map((label, weekday) => {
                    const active = dutyRoster[weekday]?.coachId === c.id;
                    return (
                      <button
                        key={weekday}
                        type="button"
                        onClick={() => toggleDuty(weekday, c)}
                        className={[
                          "rounded-lg border w-9 h-9 text-xs font-medium transition",
                          active
                            ? "bg-ink text-white border-ink"
                            : "border-line text-ink/60 hover:bg-bone",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          {coaches.filter((c) => c.active).length === 0 && (
            <p className="text-sm text-ink/40 py-2.5">재직 중인 코치가 없어요.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">공휴일 관리</h2>
        <p className="text-xs text-ink/50 mb-4">
          토요일과 동일하게 9~15시로 단축 운영되는 날입니다. 2026년 공휴일이 기본으로
          들어있지만, 설날·부처님오신날·추석처럼 음력 기반 날짜는 추정치이니 정확한 날짜로
          확인 후 조정해주세요.
        </p>
        <div className="divide-y divide-line/50 max-h-64 overflow-y-auto">
          {holidays.map((h) => (
            <div key={h.holiday_date} className="flex items-center justify-between py-2 text-sm">
              <span>
                {h.holiday_date} · {h.name}
              </span>
              <button
                onClick={() => removeHoliday(h.holiday_date)}
                className="text-xs text-red-400 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="w-full sm:w-auto min-w-0 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <input
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            placeholder="이름 (예: 대체공휴일)"
            className="flex-1 min-w-0 sm:min-w-[140px] rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <button
            onClick={addHoliday}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
        {error && <p className="text-sm text-coral mt-3">{error}</p>}
      </section>

      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">정기 일정</h2>
        <p className="text-xs text-ink/50 mb-4">
          매달 또는 분기(3·6·9·12월)마다 같은 날짜·시간에 반복되는 일정이에요. 등록하면
          재직 중인 코치 전원의 스케줄표에 자동으로 잡혀 그 시간엔 다른 예약을 받을 수
          없어요. 날짜가 토·일요일이거나 공휴일 관리에 등록된 날이면 자동으로 그다음
          평일로 미뤄져요(대체공휴일도 공휴일 관리에 등록해두면 함께 반영돼요).
        </p>
        <div className="divide-y divide-line/50">
          {recurringEvents.map((ev) => (
            <div key={ev.id} className="py-2.5 flex items-center gap-2 flex-wrap">
              <input
                defaultValue={ev.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== ev.name) patchRecurringEvent(ev.id, { name });
                }}
                className="w-28 min-w-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral"
              />
              <select
                value={ev.cycle}
                onChange={(e) =>
                  patchRecurringEvent(ev.id, { cycle: e.target.value as RecurringEventCycle })
                }
                className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
              >
                {(Object.keys(CYCLE_LABELS) as RecurringEventCycle[]).map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {CYCLE_LABELS[cycle]}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1 text-xs text-ink/60">
                매
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={ev.day_of_month}
                  onChange={(e) => {
                    const day = Number(e.target.value);
                    if (Number.isInteger(day) && day >= 1 && day <= 28) {
                      patchRecurringEvent(ev.id, { dayOfMonth: day });
                    }
                  }}
                  className="w-12 rounded-lg border border-line px-1.5 py-1.5 text-xs text-center outline-none focus:border-coral"
                />
                일
              </span>
              <span className="flex items-center gap-1 text-xs text-ink/60">
                <select
                  value={ev.start_hour}
                  onChange={(e) =>
                    patchRecurringEvent(ev.id, { startHour: Number(e.target.value) })
                  }
                  className="rounded-lg border border-line px-1.5 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {HOUR_OPTIONS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                ~
                <select
                  value={ev.end_hour}
                  onChange={(e) => patchRecurringEvent(ev.id, { endHour: Number(e.target.value) })}
                  className="rounded-lg border border-line px-1.5 py-1.5 text-xs outline-none focus:border-coral"
                >
                  {HOUR_OPTIONS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
              </span>
              <label className="flex items-center gap-1 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={ev.enabled}
                  onChange={(e) => patchRecurringEvent(ev.id, { enabled: e.target.checked })}
                />
                사용
              </label>
              <button
                onClick={() => removeRecurringEvent(ev.id)}
                className="ml-auto shrink-0 text-xs text-red-400 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
          {recurringEvents.length === 0 && (
            <p className="text-sm text-ink/40 py-2.5">등록된 정기 일정이 없어요.</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
          <input
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="이름 (예: 스터디)"
            className="flex-1 min-w-0 sm:w-28 rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
          />
          <select
            value={newEventCycle}
            onChange={(e) => setNewEventCycle(e.target.value as RecurringEventCycle)}
            className="rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-coral"
          >
            {(Object.keys(CYCLE_LABELS) as RecurringEventCycle[]).map((cycle) => (
              <option key={cycle} value={cycle}>
                {CYCLE_LABELS[cycle]}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1 text-sm text-ink/60">
            매
            <input
              type="number"
              min={1}
              max={28}
              value={newEventDay}
              onChange={(e) => setNewEventDay(Number(e.target.value))}
              className="w-14 rounded-lg border border-line px-2 py-2 text-sm text-center outline-none focus:border-coral"
            />
            일
          </span>
          <span className="flex items-center gap-1 text-sm text-ink/60">
            <select
              value={newEventStartHour}
              onChange={(e) => setNewEventStartHour(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-coral"
            >
              {HOUR_OPTIONS.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
            ~
            <select
              value={newEventEndHour}
              onChange={(e) => setNewEventEndHour(Number(e.target.value))}
              className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-coral"
            >
              {HOUR_OPTIONS.slice(1).map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
          </span>
          <button
            onClick={addRecurringEvent}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
        </div>
      </section>

      <MemoPad
        title="메모장"
        initialMemos={initialSettingsMemos}
        addUrl="/api/admin/settings-memos"
        idToDeleteUrl={(id) => `/api/admin/settings-memos/${id}`}
      />
    </div>
  );
}
