"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PURPOSE_OPTIONS, businessHours, BOOKING_WINDOW_DAYS } from "@/lib/constants";
import { addDaysToKey, koreaCurrentHour, koreaTodayKey } from "@/lib/date";

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

export function ReservationForm() {
  const todayKey = koreaTodayKey();
  const currentHour = koreaCurrentHour();
  const maxKey = addDaysToKey(todayKey, BOOKING_WINDOW_DAYS);
  const [todayY, todayM] = todayKey.split("-").map(Number);

  const [viewYear, setViewYear] = useState(todayY);
  const [viewMonth, setViewMonth] = useState(todayM);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [taken, setTaken] = useState<Set<string>>(() => new Set());

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

  // 페이지 자체는 정적으로 즉시 렌더링하고, 예약 현황만 마운트 후 비동기로 불러온다
  // (DB 조회가 홈페이지 첫 응답을 막지 않도록 하기 위함).
  useEffect(() => {
    fetch("/api/reservations", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTaken(toTakenSet(data.taken ?? [])))
      .catch(() => {
        // 네트워크 오류 시엔 목록을 갱신하지 못해도 예약 시도 시 서버가 다시 막아준다.
      });
  }, []);

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
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goPrevMonth}
            className="px-3 py-1 rounded-full border border-[#1F2A24]/[0.15] transition-all duration-200 hover:bg-[#EFE6D3] hover:scale-105 active:scale-95"
            aria-label="이전 달"
          >
            ‹
          </button>
          <p className="font-serif-display text-xl">{monthLabel}</p>
          <button
            type="button"
            onClick={goNextMonth}
            className="px-3 py-1 rounded-full border border-[#1F2A24]/[0.15] transition-all duration-200 hover:bg-[#EFE6D3] hover:scale-105 active:scale-95"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-sm text-[#1F2A24]/60 mb-2">
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
                    ? "bg-[#1F2A24] text-[#EFE6D3] font-semibold border border-[#D9C08F]"
                    : selectable
                      ? "hover:bg-[#D9C08F]/20 hover:scale-105 active:scale-95 border border-[#1F2A24]/[0.15]"
                      : "text-[#1F2A24]/25 border border-transparent cursor-not-allowed",
                  isToday && !isSelected ? "ring-1 ring-[#D9C08F]" : "",
                ].join(" ")}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-[#1F2A24]/50 mt-3">
          오늘부터 {BOOKING_WINDOW_DAYS}일 이내로 예약하실 수 있어요.
        </p>

        {selectedDate && (
          <div className="mt-12">
            <p className="text-[23px] font-medium mb-3">{selectedDate} 시간 선택</p>
            <div className="flex flex-wrap gap-3.5">
              {hours.map((h) => {
                const isPast = selectedDate === todayKey && h <= currentHour;
                const isTaken = taken.has(`${selectedDate}-${h}`) || isPast;
                const isSelected = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={isTaken}
                    onClick={() => setSelectedHour(h)}
                    className={[
                      "px-3.5 py-2 rounded-full text-[13px] border transition-all duration-200",
                      isTaken
                        ? "border-[#1F2A24]/[0.15] text-[#1F2A24]/30 line-through cursor-not-allowed"
                        : isSelected
                          ? "bg-[#1F2A24] text-[#EFE6D3] border-[#1F2A24] shadow-md shadow-black/10"
                          : "border-[#1F2A24]/[0.15] text-[#1F2A24] hover:border-[#D9C08F] hover:scale-105 active:scale-95",
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

      {success ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#1F2A24] px-7 py-10 text-center text-[#EFE6D3]">
          <p className="font-serif-display text-[22px]">예약 신청이 접수됐어요</p>
          <p className="text-sm leading-relaxed text-[#EFE6D3]/70">
            {success.date} {success.hour}:00에 예약해드릴게요.
            <br />
            남겨주신 연락처로 확인 안내드릴게요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">성함</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
              className="w-full box-border rounded-[10px] border border-[#1F2A24]/[0.15] bg-white/60 px-3.5 py-2.5 text-[15px] outline-none focus:border-[#D9C08F] focus:ring-1 focus:ring-[#D9C08F]"
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
              className="w-full box-border rounded-[10px] border border-[#1F2A24]/[0.15] bg-white/60 px-3.5 py-2.5 text-[15px] outline-none focus:border-[#D9C08F] focus:ring-1 focus:ring-[#D9C08F]"
              placeholder="30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">연락처</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full box-border rounded-[10px] border border-[#1F2A24]/[0.15] bg-white/60 px-3.5 py-2.5 text-[15px] outline-none focus:border-[#D9C08F] focus:ring-1 focus:ring-[#D9C08F]"
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
                      "px-3.5 py-2 rounded-full text-[13px] border transition-all duration-200",
                      checked
                        ? "bg-[#8A6D3B] border-[#8A6D3B] text-[#F6F1E7]"
                        : "border-[#1F2A24]/[0.15] text-[#1F2A24]/70 hover:border-[#8A6D3B] hover:scale-105",
                      "active:scale-95",
                    ].join(" ")}
                  >
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
              className="w-full rounded-[10px] border border-[#1F2A24]/[0.15] bg-white/60 px-3.5 py-2.5 text-sm outline-none focus:border-[#D9C08F] focus:ring-1 focus:ring-[#D9C08F] resize-none"
              placeholder="추가로 알려주고 싶은 내용을 한 줄 정도 적어주세요. (예: 허리 디스크 재활 중이에요)"
            />
          </div>

          <div className="rounded-[10px] border border-[#1F2A24]/[0.15] bg-white/[0.5] px-3.5 py-2.5 text-sm">
            선택한 시간:{" "}
            {selectedDate && selectedHour !== null ? (
              <span className="text-[#1F2A24]">
                {selectedDate} {selectedHour}:00 - {selectedHour + 1}:00
              </span>
            ) : (
              <span className="text-[#1F2A24]/50">왼쪽 달력에서 날짜와 시간을 선택해주세요.</span>
            )}
          </div>

          {error && (
            <p className="text-sm text-coral font-medium" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#1F2A24] text-[#EFE6D3] py-3.5 text-[15px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {submitting ? "예약 처리 중..." : "사전예약 신청하기"}
          </button>
        </form>
      )}
    </div>
  );
}
