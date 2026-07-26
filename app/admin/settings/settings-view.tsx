"use client";

import { useState } from "react";
import type { CoachRow, HolidayRow } from "@/lib/db";

export function SettingsView({
  initialCoaches,
  initialHolidays,
}: {
  initialCoaches: CoachRow[];
  initialHolidays: HolidayRow[];
}) {
  const [coaches, setCoaches] = useState(initialCoaches);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [newCoachName, setNewCoachName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addCoach() {
    if (!newCoachName.trim()) return;
    setError(null);
    const res = await fetch("/api/admin/coaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCoachName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "코치 등록에 실패했습니다.");
      return;
    }
    setCoaches((prev) => [...prev, data.coach]);
    setNewCoachName("");
  }

  async function toggleCoach(coach: CoachRow) {
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
        <h2 className="font-display text-lg mb-1">코치 관리</h2>
        <p className="text-xs text-ink/50 mb-4">
          지금은 신종수 코치 1명이지만, 나중에 코치가 추가되면 여기서 등록해주세요. 등록하는
          즉시 스케줄표에 컬럼이 생깁니다.
        </p>
        <div className="divide-y divide-line/50">
          {coaches.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm">{c.name}</span>
              <button
                onClick={() => toggleCoach(c)}
                className={[
                  "rounded-full px-3 py-1 text-xs border transition",
                  c.active
                    ? "border-sage/50 text-sage bg-sage/10"
                    : "border-line text-ink/40",
                ].join(" ")}
              >
                {c.active ? "근무 중" : "비활성"}
              </button>
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
          <button
            onClick={addCoach}
            className="shrink-0 whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
          >
            추가
          </button>
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
    </div>
  );
}
