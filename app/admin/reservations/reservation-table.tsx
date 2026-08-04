"use client";

import { useMemo, useState } from "react";
import { PURPOSE_LABELS } from "@/lib/constants";
import type { ReservationRow } from "@/lib/db";

type SortKey = "reservation_date" | "created_at";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-medium whitespace-nowrap">
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-coral">
        {label}
        <span className={active ? "text-coral" : "text-ink/30"}>{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

export function ReservationTable({
  initialReservations,
}: {
  initialReservations: ReservationRow[];
}) {
  const [reservations, setReservations] = useState(initialReservations);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedReservations = useMemo(() => {
    const sortValue = (r: ReservationRow) =>
      sortKey === "reservation_date"
        ? `${r.reservation_date}T${String(r.reservation_hour).padStart(2, "0")}`
        : r.created_at;
    return [...reservations].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [reservations, sortKey, sortDir]);

  async function handleDelete(id: number) {
    if (!confirm("이 예약을 취소(삭제)할까요?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/reservations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setReservations((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="font-display text-2xl">사전예약 현황</p>
        <p className="text-sm text-ink/60 mt-1">총 {reservations.length}건</p>
      </div>

      {reservations.length === 0 ? (
        <p className="text-ink/50">아직 예약이 없어요.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-bone text-left">
                <SortHeader
                  label="날짜"
                  active={sortKey === "reservation_date"}
                  dir={sortKey === "reservation_date" ? sortDir : "asc"}
                  onClick={() => toggleSort("reservation_date")}
                />
                <th className="px-4 py-3 font-medium whitespace-nowrap">시간</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">성함</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">나이</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">운동 목적</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">설명</th>
                <SortHeader
                  label="신청 시각"
                  active={sortKey === "created_at"}
                  dir={sortKey === "created_at" ? sortDir : "asc"}
                  onClick={() => toggleSort("created_at")}
                />
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sortedReservations.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{r.reservation_date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.reservation_hour}:00 - {r.reservation_hour + 1}:00
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.age}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                  <td className="px-4 py-3">
                    {r.purposes.map((p) => PURPOSE_LABELS[p] ?? p).join(", ")}
                  </td>
                  <td className="px-4 py-3 max-w-xs">{r.purpose_note || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink/50">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="text-coral hover:underline disabled:opacity-50"
                    >
                      취소
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
