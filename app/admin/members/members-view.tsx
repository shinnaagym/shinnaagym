"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoachRow, MemberStatus, PackageRow } from "@/lib/db";
import type { MemberWithProgress } from "@/lib/schedule";

type SessionSummary = {
  id: number;
  session_date: string;
  session_hour: number;
  status: string;
};

export function MembersView({
  initialMembers,
  coaches,
}: {
  initialMembers: MemberWithProgress[];
  coaches: CoachRow[];
}) {
  const members = initialMembers;
  const activeCoaches = useMemo(() => coaches.filter((c) => c.active), [coaches]);
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState<number | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (search && !m.name.includes(search)) return false;
      if (coachFilter !== "all" && m.coach_id !== coachFilter) return false;
      return true;
    });
  }, [members, search, coachFilter]);

  async function refresh() {
    const res = await fetch("/api/admin/members");
    if (res.ok) {
      // 목록 API는 progress를 포함하지 않으므로 페이지 새로고침으로 최신화한다.
      window.location.reload();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색"
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-coral"
          />
          <select
            value={coachFilter}
            onChange={(e) =>
              setCoachFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="all">담당 코치 전체</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink/50">{filtered.length}명</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-coral text-white px-5 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          + 신규 회원 등록
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-5 py-10 text-center text-ink/40">
          회원이 없어요.
        </div>
      ) : (
        <>
          {/* 모바일: 카드 목록 (좁은 화면에서 표 가로 스크롤 대신) */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map((m) => {
              const remaining = m.total_sessions - m.done_count;
              const pct =
                m.total_sessions > 0
                  ? Math.min(100, Math.round((m.done_count / m.total_sessions) * 100))
                  : 0;
              const coachName = coaches.find((c) => c.id === m.coach_id)?.name ?? "-";
              return (
                <button
                  key={m.id}
                  onClick={() => setDetailId(m.id)}
                  className="text-left rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5 active:bg-bone/40 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{m.name}</span>
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-xs shrink-0",
                        m.status === "active"
                          ? "bg-sage/20 text-sage"
                          : "bg-line/40 text-ink/50",
                      ].join(" ")}
                    >
                      {m.status === "active" ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 rounded-full bg-line/60 overflow-hidden">
                      <div className="h-full bg-coral rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-ink/50 whitespace-nowrap">
                      {m.done_count}/{m.total_sessions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/60">
                    <span>담당 {coachName}</span>
                    <span className={remaining <= 3 ? "text-coral font-medium" : ""}>
                      잔여 {remaining}회
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-5 py-3 font-medium">이름</th>
                  <th className="px-5 py-3 font-medium">담당</th>
                  <th className="px-5 py-3 font-medium">진행</th>
                  <th className="px-5 py-3 font-medium">잔여</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const remaining = m.total_sessions - m.done_count;
                  const pct =
                    m.total_sessions > 0
                      ? Math.min(100, Math.round((m.done_count / m.total_sessions) * 100))
                      : 0;
                  const coachName = coaches.find((c) => c.id === m.coach_id)?.name ?? "-";
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setDetailId(m.id)}
                      className="border-b border-line/40 last:border-0 hover:bg-bone/40 cursor-pointer transition"
                    >
                      <td className="px-5 py-3 font-medium">{m.name}</td>
                      <td className="px-5 py-3 text-ink/70">{coachName}</td>
                      <td className="px-5 py-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-line/60 overflow-hidden">
                            <div
                              className="h-full bg-coral rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink/50 whitespace-nowrap">
                            {m.done_count}/{m.total_sessions}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            remaining <= 3 ? "text-coral font-medium" : "text-ink/70"
                          }
                        >
                          {remaining}회
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={[
                            "rounded-full px-2.5 py-0.5 text-xs",
                            m.status === "active"
                              ? "bg-sage/20 text-sage"
                              : "bg-line/40 text-ink/50",
                          ].join(" ")}
                        >
                          {m.status === "active" ? "활성" : "비활성"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreate && (
        <CreateMemberModal
          coaches={activeCoaches}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {detailId && (
        <MemberDetailModal
          memberId={detailId}
          coaches={coaches}
          activeCoaches={activeCoaches}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function CreateMemberModal({
  coaches,
  onClose,
  onCreated,
}: {
  coaches: CoachRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [coachId, setCoachId] = useState<number | "">(coaches[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [totalSessions, setTotalSessions] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!totalSessions || Number(totalSessions) < 1) {
      setError("등록 횟수를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          coachId: coachId === "" ? null : coachId,
          notes,
          totalSessions: Number(totalSessions),
          price: Number(price || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      onCreated();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="신규 회원 등록" onClose={onClose}>
      <div className="space-y-4">
        <Field label="이름 *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="연락처">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="담당 코치">
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none"
          >
            <option value="">미지정</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="등록 횟수 *">
            <input
              type="number"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
              placeholder="예: 30"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
          <Field label="결제 금액">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 1700000"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        </div>
        <Field label="메모">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral resize-none"
          />
        </Field>
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "등록"}
        </button>
      </div>
    </ModalShell>
  );
}

function MemberDetailModal({
  memberId,
  coaches,
  activeCoaches,
  onClose,
  onChanged,
}: {
  memberId: number;
  coaches: CoachRow[];
  activeCoaches: CoachRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{
    member: { id: number; name: string; phone: string; coach_id: number | null; token: string; status: MemberStatus };
    progress: { totalSessions: number; doneCount: number; remaining: number };
    packages: PackageRow[];
    sessions: SessionSummary[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addSessions, setAddSessions] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [coachSaving, setCoachSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/members/${memberId}`)
      .then((res) => res.json())
      .then(setData);
  }, [memberId]);

  if (!data) {
    return (
      <ModalShell title="불러오는 중..." onClose={onClose}>
        <p className="text-sm text-ink/50">잠시만 기다려주세요.</p>
      </ModalShell>
    );
  }

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/my/${data.member.token}` : "";

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleAddPackage() {
    if (!addSessions || Number(addSessions) < 1) {
      setError("추가할 횟수를 입력해주세요.");
      return;
    }
    const res = await fetch(`/api/admin/members/${memberId}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalSessions: Number(addSessions), price: Number(addPrice || 0) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가에 실패했습니다.");
      return;
    }
    setAddSessions("");
    setAddPrice("");
    onChanged();
    onClose();
  }

  async function handleCoachChange(newCoachId: number | null) {
    setCoachSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachId: newCoachId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "담당 코치 변경에 실패했습니다.");
        return;
      }
      setData((prev) => (prev ? { ...prev, member: { ...prev.member, coach_id: newCoachId } } : prev));
      onChanged();
    } finally {
      setCoachSaving(false);
    }
  }

  async function handleStatusToggle() {
    const nextStatus = data!.member.status === "active" ? "inactive" : "active";
    await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    onChanged();
    onClose();
  }

  return (
    <ModalShell title={`${data.member.name} — 회원 정보`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm space-y-2">
          <p>
            진행 {data.progress.doneCount} / {data.progress.totalSessions} · 잔여{" "}
            {data.progress.remaining}회
          </p>
          <div className="flex items-center gap-2">
            <span className="text-ink/50 shrink-0">담당 코치</span>
            <select
              value={data.member.coach_id ?? ""}
              disabled={coachSaving}
              onChange={(e) =>
                handleCoachChange(e.target.value ? Number(e.target.value) : null)
              }
              className="flex-1 min-w-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-coral disabled:opacity-50"
            >
              <option value="">미지정</option>
              {activeCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {/* 이미 퇴사한 코치가 배정돼 있다면 목록에 없어도 현재 값은 보여준다 */}
              {data.member.coach_id &&
                !activeCoaches.some((c) => c.id === data.member.coach_id) && (
                  <option value={data.member.coach_id}>
                    {coaches.find((c) => c.id === data.member.coach_id)?.name ?? "알 수 없음"}
                    (퇴사)
                  </option>
                )}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">개인 예약 링크</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink/60 bg-bone/30"
            />
            <button
              onClick={copyLink}
              className="rounded-lg border border-line px-3 py-2 text-xs hover:bg-bone transition whitespace-nowrap"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <p className="text-[11px] text-ink/40 mt-1">
            이 링크는 본인만 확인 가능하며 다른 회원 이름은 노출되지 않습니다.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">패키지 추가</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={addSessions}
              onChange={(e) => setAddSessions(e.target.value)}
              placeholder="횟수"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <input
              type="number"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="결제금액"
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </div>
          <button
            onClick={handleAddPackage}
            className="mt-2 w-full rounded-full border border-coral text-coral py-2 text-sm font-medium hover:bg-coral/5 transition"
          >
            + 재등록/패키지 추가
          </button>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">최근 세션</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {data.sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex justify-between text-xs text-ink/60">
                <span>
                  {s.session_date} {s.session_hour}:00
                </span>
                <span>{s.status}</span>
              </div>
            ))}
            {data.sessions.length === 0 && (
              <p className="text-xs text-ink/40">아직 세션 기록이 없어요.</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <button
          onClick={handleStatusToggle}
          className="w-full rounded-full border border-line py-2 text-sm hover:bg-bone transition"
        >
          {data.member.status === "active" ? "비활성으로 전환" : "다시 활성화"}
        </button>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 my-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{title}</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
