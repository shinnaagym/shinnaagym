"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FOLLOWUP_OPTIONS = ["대기", "연락함", "재등록 확정", "보류", "이탈"];

interface GoldenMember {
  id: number;
  name: string;
  coachName: string;
  doneCount: number;
  totalSessions: number;
  availableTimes: string;
  followupStatus: string;
  followupMemo: string;
}

/** 팔로업 상태를 "이탈"로 바꿀 때 이유를 입력받는 확인 모달 — 입력해야만 확정할 수 있다. */
function ChurnReasonModal({
  memberName,
  onCancel,
  onConfirm,
}: {
  memberName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg px-5 py-5">
        <p className="font-display text-base mb-1">{memberName}님 이탈 처리</p>
        <p className="text-xs text-ink/50 mb-3">이탈 이유를 남겨주세요.</p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 타 지역 이사, 비용 부담, 연락 두절 등"
          rows={3}
          className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-coral resize-y mb-4"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-bone transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="rounded-full bg-coral text-white px-4 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            이탈 처리
          </button>
        </div>
      </div>
    </div>
  );
}

export function GoldenTimeTable({ members }: { members: GoldenMember[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(members);
  const [pendingChurnId, setPendingChurnId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function updateStatus(id: number, status: string, memo?: string) {
    setSavingId(id);
    try {
      const body: Record<string, string> = { followupStatus: status };
      if (memo !== undefined) body.followupMemo = memo;
      const res = await fetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, followupStatus: status, followupMemo: memo ?? m.followupMemo }
              : m,
          ),
        );
        router.refresh();
      }
    } finally {
      setSavingId(null);
    }
  }

  function handleStatusChange(id: number, status: string) {
    if (status === "이탈") {
      setPendingChurnId(id);
      return;
    }
    updateStatus(id, status);
  }

  const pendingMember = rows.find((m) => m.id === pendingChurnId);

  if (rows.length === 0) {
    return <p className="text-sm text-ink/40 py-6 text-center">잔여 3회 이하인 회원이 없어요.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-ink/50 text-xs border-b border-line/60">
              <th className="py-2 pr-4 font-medium">회원</th>
              <th className="py-2 px-3 font-medium">담당</th>
              <th className="py-2 px-3 font-medium">진행</th>
              <th className="py-2 px-3 font-medium">잔여</th>
              <th className="py-2 px-3 font-medium">가능 시간</th>
              <th className="py-2 px-3 font-medium">팔로업</th>
              <th className="py-2 px-3 font-medium text-center">결제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const remaining = m.totalSessions - m.doneCount;
              const expired = remaining <= 0;
              return (
                <tr key={m.id} className="border-b border-line/40 last:border-0 align-top">
                  <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{m.name}</td>
                  <td className="py-2.5 px-3 text-ink/70 whitespace-nowrap">{m.coachName}</td>
                  <td className="py-2.5 px-3 text-ink/70 whitespace-nowrap">
                    {m.doneCount}/{m.totalSessions}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {expired ? (
                      <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-xs font-medium">
                        만료
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">{remaining}회</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-ink/60 text-xs whitespace-nowrap">
                    {m.availableTimes || "-"}
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={m.followupStatus}
                      disabled={savingId === m.id}
                      onChange={(e) => handleStatusChange(m.id, e.target.value)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-coral disabled:opacity-50"
                    >
                      {FOLLOWUP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {m.followupStatus === "이탈" && m.followupMemo && (
                      <p
                        className="text-[11px] text-ink/40 mt-1 max-w-[180px] truncate"
                        title={m.followupMemo}
                      >
                        사유: {m.followupMemo}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <Link
                      href={`/admin/members?open=${m.id}`}
                      className="inline-block rounded-full bg-ink text-white px-3 py-1.5 text-xs hover:bg-coral transition"
                    >
                      결제
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendingMember && (
        <ChurnReasonModal
          memberName={pendingMember.name}
          onCancel={() => setPendingChurnId(null)}
          onConfirm={(reason) => {
            updateStatus(pendingMember.id, "이탈", reason);
            setPendingChurnId(null);
          }}
        />
      )}
    </>
  );
}
