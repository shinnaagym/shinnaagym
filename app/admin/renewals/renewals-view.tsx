"use client";

import { useMemo, useState } from "react";
import type { CoachRow } from "@/lib/db";
import type { MemberWithProgress, PackagePurchaseEntry } from "@/lib/schedule";

const FOLLOWUP_OPTIONS = ["대기", "재등록 완료", "이탈"] as const;

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function RenewalsView({
  initialMembers,
  coaches,
  completedRenewals,
}: {
  initialMembers: MemberWithProgress[];
  coaches: CoachRow[];
  completedRenewals: PackagePurchaseEntry[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [packageTarget, setPackageTarget] = useState<MemberWithProgress | null>(null);

  const goldenTime = useMemo(() => {
    return members
      .filter((m) => m.status === "active" && m.total_sessions > 0)
      .map((m) => ({ ...m, remaining: m.total_sessions - m.done_count }))
      .filter((m) => m.remaining <= 3)
      .sort((a, b) => a.remaining - b.remaining);
  }, [members]);

  function coachName(coachId: number | null): string {
    return coaches.find((c) => c.id === coachId)?.name ?? "-";
  }

  async function patchMember(
    id: number,
    updates: Partial<Pick<MemberWithProgress, "followup_status" | "followup_memo">>,
  ) {
    setSavingId(id);
    try {
      const body: Record<string, unknown> = {};
      if (updates.followup_status !== undefined) body.followupStatus = updates.followup_status;
      if (updates.followup_memo !== undefined) body.followupMemo = updates.followup_memo;

      const res = await fetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-4 mb-6 text-sm text-ink/60 leading-relaxed">
        <span className="font-medium text-ink">🔔 재등록 골든타임</span> — 잔여 3회 이하인 활성
        회원이 자동으로 아래 목록에 나타나요. 잔여가 적을수록 먼저 표시돼요. 팔로업 상태와 메모를
        남겨서 연락 진행 상황을 관리하세요.
      </div>

      {goldenTime.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40 mb-6">
          지금은 골든타임 대상 회원이 없어요.
        </div>
      ) : (
        <>
          {/* 모바일: 카드 */}
          <div className="grid gap-3 sm:hidden mb-6">
            {goldenTime.map((m) => {
              const expired = m.remaining <= 0;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.name}</span>
                    {expired ? (
                      <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-xs font-medium">
                        만료
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                        잔여 {m.remaining}회
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink/50">
                    담당 {coachName(m.coach_id)} · 진행 {m.done_count}/{m.total_sessions}
                    {m.available_times && ` · ${m.available_times}`}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={m.followup_status}
                      disabled={savingId === m.id}
                      onChange={(e) => patchMember(m.id, { followup_status: e.target.value })}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none disabled:opacity-50"
                    >
                      {FOLLOWUP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setPackageTarget(m)}
                      className="rounded-lg bg-ink text-white text-xs font-medium hover:bg-coral transition"
                    >
                      결제
                    </button>
                  </div>
                  <input
                    defaultValue={m.followup_memo}
                    placeholder="메모"
                    onBlur={(e) => patchMember(m.id, { followup_memo: e.target.value })}
                    className="w-full rounded-lg border border-line px-2.5 py-1.5 text-xs outline-none focus:border-coral"
                  />
                </div>
              );
            })}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-5 py-3 font-medium">회원</th>
                  <th className="px-5 py-3 font-medium">담당</th>
                  <th className="px-5 py-3 font-medium">진행</th>
                  <th className="px-5 py-3 font-medium">잔여</th>
                  <th className="px-5 py-3 font-medium">가능 시간</th>
                  <th className="px-5 py-3 font-medium">팔로업</th>
                  <th className="px-5 py-3 font-medium">메모</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {goldenTime.map((m) => {
                  const expired = m.remaining <= 0;
                  const pct =
                    m.total_sessions > 0
                      ? Math.min(100, Math.round((m.done_count / m.total_sessions) * 100))
                      : 0;
                  return (
                    <tr key={m.id} className="border-b border-line/40 last:border-0">
                      <td className="px-5 py-3 font-medium">{m.name}</td>
                      <td className="px-5 py-3 text-ink/70">{coachName(m.coach_id)}</td>
                      <td className="px-5 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-line/60 overflow-hidden">
                            <div
                              className={[
                                "h-full rounded-full",
                                expired ? "bg-red-400" : "bg-amber-400",
                              ].join(" ")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink/50 whitespace-nowrap">
                            {m.done_count}/{m.total_sessions}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {expired ? (
                          <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-xs font-medium">
                            만료
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                            {m.remaining}회
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink/60 text-xs">
                        {m.available_times || "-"}
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={m.followup_status}
                          disabled={savingId === m.id}
                          onChange={(e) => patchMember(m.id, { followup_status: e.target.value })}
                          className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                        >
                          {FOLLOWUP_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          defaultValue={m.followup_memo}
                          placeholder="메모"
                          onBlur={(e) => patchMember(m.id, { followup_memo: e.target.value })}
                          className="w-full min-w-[120px] rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setPackageTarget(m)}
                          className="rounded-full bg-ink text-white px-3 py-1.5 text-xs font-medium hover:bg-coral transition whitespace-nowrap"
                        >
                          결제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-5">
        <p className="text-sm font-medium mb-3">이번 달 재등록 완료</p>
        {completedRenewals.length === 0 ? (
          <p className="text-sm text-ink/40">이번 달 재등록 완료 사례가 없어요.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {completedRenewals.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-bone/40 px-3.5 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{p.memberName}</p>
                  <p className="text-xs text-ink/50">
                    담당 {p.coachName ?? "-"} · {formatDate(p.purchasedAt)}
                  </p>
                </div>
                <p className="text-gold font-medium text-sm whitespace-nowrap">
                  {p.totalSessions}회 · {formatWon(p.price)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {packageTarget && (
        <QuickPackageModal
          member={packageTarget}
          onClose={() => setPackageTarget(null)}
          onSaved={() => {
            setPackageTarget(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function QuickPackageModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberWithProgress;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalSessions, setTotalSessions] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!totalSessions || Number(totalSessions) < 1) {
      setError("등록 횟수를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalSessions: Number(totalSessions),
          price: Number(price || 0),
          note: "재등록",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "등록에 실패했습니다.");
        return;
      }
      onSaved();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{member.name} — 재등록 결제</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">등록 횟수 *</label>
            <input
              type="number"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
              placeholder="예: 30"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">결제 금액</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 1700000"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "재등록 결제 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
