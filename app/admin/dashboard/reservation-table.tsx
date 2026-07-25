"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PURPOSE_LABELS } from "@/lib/constants";
import type { ReservationRow } from "@/lib/db";

export function ReservationTable({
  initialReservations,
}: {
  initialReservations: ReservationRow[];
}) {
  const router = useRouter();
  const [reservations, setReservations] = useState(initialReservations);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
    router.refresh();
  }

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-display text-2xl">예약 현황</p>
          <p className="text-sm text-ink/60 mt-1">총 {reservations.length}건</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-full border border-line px-4 py-2 text-sm hover:bg-bone transition"
        >
          로그아웃
        </button>
      </div>

      {reservations.length === 0 ? (
        <p className="text-ink/50">아직 예약이 없어요.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bone text-left">
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">시간</th>
                <th className="px-4 py-3 font-medium">성함</th>
                <th className="px-4 py-3 font-medium">나이</th>
                <th className="px-4 py-3 font-medium">연락처</th>
                <th className="px-4 py-3 font-medium">운동 목적</th>
                <th className="px-4 py-3 font-medium">설명</th>
                <th className="px-4 py-3 font-medium">신청 시각</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
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
