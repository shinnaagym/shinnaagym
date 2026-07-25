"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PURPOSE_OPTIONS, businessHours, BOOKING_WINDOW_DAYS } from "@/lib/constants";
import { addDaysToKey, koreaTodayKey } from "@/lib/date";

type TakenSlot = { date: string; hour: number };

function toTakenSet(slots: TakenSlot[]): Set<string> {
  return new Set(slots.map((t) => `${t.date}-${t.hour}`));
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { key: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ key: `blank-${i}`, day: 0, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${year}-${pad(month)}-${pad(d)}`, day: d, inMonth: true });
  }
  return cells;
}

export function ReservationForm({ initialTaken }: { initialTaken: TakenSlot[] }) {
  const todayKey = koreaTodayKey();
  const maxKey = addDaysToKey(todayKey, BOOKING_WINDOW_DAYS);
  const [todayY, todayM] = todayKey.split("-").map(Number);

  const [viewYear, setViewYear] = useState(todayY);
  const [viewMonth, setViewMonth] = useState(todayM);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<string>>(() => toTakenSet(initialTaken));

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [purposeNote, setPurposeNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ date: string; hour: number } | null>(null);

  async function refreshTaken() {
    try {
      const res = await fetch("/api/reservations", { cache: "no-store" });
      const data = await res.json();
      setTaken(toTakenSet(data.taken ?? []));
    } catch {
      // 네트워크 오류 시엔 목록을 갱신하지 못해도 예약 시도 시 서버가 다시 막아준다.
    }
  }

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = `${viewYear}년 ${viewMonth}월`;

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }
  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  function isSelectable(key: string) {
    return key >= todayKey && key <= maxKey;
  }

  function selectDate(key: string) {
    if (!isSelectable(key)) return;
    setSelectedDate(key);
    setSelectedHour(null);
    setSuccess(null);
    setError(null);
  }

  function togglePurpose(value: string) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedDate || selectedHour === null) {
      setError("예약 날짜와 시간을 선택해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("성함을 입력해주세요.");
      return;
    }
    if (!age || Number(age) < 1 || Number(age) > 120) {
      setError("나이를 올바르게 입력해주세요.");
      return;
    }
    if (!phone.trim()) {
      setError("연락처를 입력해주세요.");
      return;
    }
    if (purposes.length === 0) {
      setError("운동 목적을 하나 이상 선택해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age: Number(age),
          phone,
          purposes,
          purposeNote,
          date: selectedDate,
          hour: selectedHour,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "예약 중 오류가 발생했습니다.");
        await refreshTaken();
        return;
      }
      setSuccess({ date: selectedDate, hour: selectedHour });
      setName("");
      setAge("");
      setPhone("");
      setPurposes([]);
      setPurposeNote("");
      setSelectedDate(null);
      setSelectedHour(null);
      await refreshTaken();
    } catch {
      setError("네트워크 오류로 예약에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const hours = businessHours();

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrevMonth}
            className="px-3 py-1 rounded-full border border-line transition-all duration-200 hover:bg-bone hover:scale-105 active:scale-95"
            aria-label="이전 달"
          >
            ‹
          </button>
          <p className="font-display text-xl">{monthLabel}</p>
          <button
            type="button"
            onClick={goNextMonth}
            className="px-3 py-1 rounded-full border border-line transition-all duration-200 hover:bg-bone hover:scale-105 active:scale-95"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-sm text-ink/60 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell) => {
            if (!cell.inMonth) return <div key={cell.key} />;
            const selectable = isSelectable(cell.key);
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedDate;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={!selectable}
                onClick={() => selectDate(cell.key)}
                className={[
                  "aspect-square rounded-xl text-sm transition-all duration-200 flex items-center justify-center",
                  isSelected
                    ? "bg-ink text-bone font-semibold"
                    : selectable
                      ? "hover:bg-sage/25 hover:scale-105 active:scale-95 border border-line"
                      : "text-ink/25 border border-transparent cursor-not-allowed",
                  isToday && !isSelected ? "ring-1 ring-coral" : "",
                ].join(" ")}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink/50 mt-3">
          오늘부터 {BOOKING_WINDOW_DAYS}일 이내로 예약하실 수 있어요.
        </p>

        {selectedDate && (
          <div className="mt-6">
            <p className="text-sm text-ink/70 mb-2">{selectedDate} 예약 가능 시간</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {hours.map((h) => {
                const isTaken = taken.has(`${selectedDate}-${h}`);
                const isSelected = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={isTaken}
                    onClick={() => setSelectedHour(h)}
                    className={[
                      "py-2 rounded-lg text-sm border transition-all duration-200",
                      isTaken
                        ? "border-line text-ink/30 line-through cursor-not-allowed"
                        : isSelected
                          ? "bg-coral text-bone border-coral shadow-md shadow-coral/25"
                          : "border-line hover:border-coral hover:scale-105 active:scale-95",
                    ].join(" ")}
                  >
                    {h}:00
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">성함</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            required
            className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral"
            placeholder="홍길동"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">나이</label>
          <input
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral"
            placeholder="30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">연락처</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral"
            placeholder="010-1234-5678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">운동 목적 (중복 선택 가능)</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PURPOSE_OPTIONS.map((opt) => {
              const checked = purposes.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => togglePurpose(opt.value)}
                  aria-pressed={checked}
                  className={[
                    "px-3.5 py-2 rounded-full text-sm border transition-all duration-200",
                    checked
                      ? "bg-sage/30 border-sage text-ink"
                      : "border-line text-ink/70 hover:border-sage hover:scale-105",
                    "active:scale-95",
                  ].join(" ")}
                >
                  {checked ? "✓ " : ""}
                  {opt.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={purposeNote}
            onChange={(e) => setPurposeNote(e.target.value)}
            maxLength={200}
            rows={2}
            className="w-full rounded-lg border border-line bg-white/60 px-3.5 py-2.5 outline-none focus:border-coral focus:ring-1 focus:ring-coral resize-none"
            placeholder="추가로 알려주고 싶은 내용을 한 줄 정도 적어주세요. (예: 허리 디스크 재활 중이에요)"
          />
        </div>

        <div className="rounded-lg border border-line bg-white/50 px-3.5 py-2.5 text-sm">
          선택한 시간:{" "}
          {selectedDate && selectedHour !== null ? (
            <span className="font-semibold text-ink">
              {selectedDate} {selectedHour}:00 - {selectedHour + 1}:00
            </span>
          ) : (
            <span className="text-ink/50">왼쪽 달력에서 날짜와 시간을 선택해주세요.</span>
          )}
        </div>

        {error && (
          <p className="text-sm text-coral font-medium" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-sage font-medium" role="status">
            예약이 완료됐어요! {success.date} {success.hour}:00에 뵙겠습니다. 확인 연락
            드릴게요.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink text-bone py-3.5 font-medium tracking-wide transition-all duration-200 hover:bg-coral hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/25 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {submitting ? "예약 처리 중..." : "사전예약 신청하기"}
        </button>
      </form>
    </div>
  );
}
