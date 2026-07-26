"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoachRow, MemberStatus, PackageRow } from "@/lib/db";
import type { MemberWithProgress } from "@/lib/schedule";

type SessionSummary = {
  id: number;
  session_date: string;
  session_hour: number;
  status: string;
  ordinal: number | null;
  total_sessions: number | null;
};

type MemberDetail = {
  id: number;
  name: string;
  phone: string;
  coach_id: number | null;
  notes: string;
  referrer: string;
  available_times: string;
  token: string;
  status: MemberStatus;
};

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function packageRate(pkg: { price: number; total_sessions: number }): number {
  return pkg.total_sessions > 0 ? Math.round(pkg.price / pkg.total_sessions) : 0;
}

function TypeBadge({ isFirst }: { isFirst: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        isFirst ? "bg-coral/10 text-coral" : "bg-sage/20 text-sage",
      ].join(" ")}
    >
      {isFirst ? "초" : "재"}
    </span>
  );
}

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
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (search && !m.name.includes(search)) return false;
      if (coachFilter !== "all" && m.coach_id !== coachFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, search, coachFilter, statusFilter]);

  async function refresh() {
    window.location.reload();
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | "all")}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="all">전체</option>
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
              const expired = m.total_sessions > 0 && remaining <= 0;
              const low = !expired && remaining > 0 && remaining <= 3;
              const rate = m.latest_price != null && m.latest_total_sessions
                ? packageRate({ price: m.latest_price, total_sessions: m.latest_total_sessions })
                : null;
              return (
                <button
                  key={m.id}
                  onClick={() => setDetailId(m.id)}
                  className="text-left rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5 active:bg-bone/40 transition"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-medium flex items-center gap-1.5">
                      {m.name}
                      {m.total_sessions > 0 && <TypeBadge isFirst={m.package_count < 2} />}
                    </span>
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
                      <div
                        className={[
                          "h-full rounded-full",
                          expired ? "bg-red-400" : low ? "bg-amber-400" : "bg-coral",
                        ].join(" ")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink/50 whitespace-nowrap">
                      {m.done_count}/{m.total_sessions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/60">
                    <span>담당 {coachName}</span>
                    <span>{rate !== null ? `회당 ${formatWon(rate)}` : ""}</span>
                    {expired ? (
                      <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 font-medium">
                        만료
                      </span>
                    ) : (
                      <span className={low ? "text-amber-600 font-medium" : ""}>
                        {low && "⚠ "}잔여 {remaining}회
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden sm:block rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-ink/50 text-xs border-b border-line/60">
                  <th className="px-5 py-3 font-medium">이름</th>
                  <th className="px-5 py-3 font-medium">담당</th>
                  <th className="px-5 py-3 font-medium">진행</th>
                  <th className="px-5 py-3 font-medium">잔여</th>
                  <th className="px-5 py-3 font-medium">회당 가격</th>
                  <th className="px-5 py-3 font-medium">초/재</th>
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
                  const expired = m.total_sessions > 0 && remaining <= 0;
                  const low = !expired && remaining > 0 && remaining <= 3;
                  const rate = m.latest_price != null && m.latest_total_sessions
                    ? packageRate({ price: m.latest_price, total_sessions: m.latest_total_sessions })
                    : null;
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
                              className={[
                                "h-full rounded-full",
                                expired ? "bg-red-400" : low ? "bg-amber-400" : "bg-coral",
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
                          <span className={low ? "text-amber-600 font-medium" : "text-ink/70"}>
                            {low && "⚠ "}
                            {remaining}회
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink/70">
                        {rate !== null ? formatWon(rate) : "-"}
                      </td>
                      <td className="px-5 py-3">
                        {m.total_sessions > 0 && <TypeBadge isFirst={m.package_count < 2} />}
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
  const [referrer, setReferrer] = useState("");
  const [availableTimes, setAvailableTimes] = useState("");
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
          referrer,
          availableTimes,
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
        <div className="grid grid-cols-2 gap-3">
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
          <Field label="소개해주신 분">
            <input
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="선택 입력"
              className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        </div>
        <Field label="가능한 요일·시간">
          <input
            value={availableTimes}
            onChange={(e) => setAvailableTimes(e.target.value)}
            placeholder="예: 화·목 오전 10시"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
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
        <Field label="운동 목적 / 특이사항">
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
    member: MemberDetail;
    progress: { totalSessions: number; doneCount: number; remaining: number };
    packages: PackageRow[];
    sessions: SessionSummary[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addSessions, setAddSessions] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 편집 폼 상태
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [status, setStatus] = useState<MemberStatus>("active");
  const [referrer, setReferrer] = useState("");
  const [availableTimes, setAvailableTimes] = useState("");
  const [notes, setNotes] = useState("");

  const [editingPkgId, setEditingPkgId] = useState<number | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNote, setEditNote] = useState("");

  function loadFrom(member: MemberDetail) {
    setName(member.name);
    setPhone(member.phone);
    setCoachId(member.coach_id ?? "");
    setStatus(member.status);
    setReferrer(member.referrer);
    setAvailableTimes(member.available_times);
    setNotes(member.notes);
  }

  useEffect(() => {
    fetch(`/api/admin/members/${memberId}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        loadFrom(d.member);
      });
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

  async function handleSave() {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          coachId: coachId === "" ? null : coachId,
          status,
          referrer,
          availableTimes,
          notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "저장에 실패했습니다.");
        return;
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMember() {
    if (data!.packages.length > 0) return;
    if (!confirm(`${data!.member.name} 회원을 완전히 삭제할까요? 되돌릴 수 없어요.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "삭제에 실패했습니다.");
        return;
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
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

  function startEditPkg(pkg: PackageRow) {
    setEditingPkgId(pkg.id);
    setEditTotal(String(pkg.total_sessions));
    setEditPrice(String(pkg.price));
    setEditNote(pkg.note);
  }

  async function saveEditPkg(pkgId: number) {
    const totalSessions = Number(editTotal);
    const price = Number(editPrice);
    if (!Number.isInteger(totalSessions) || totalSessions < 1) {
      setError("횟수를 올바르게 입력해주세요.");
      return;
    }
    const res = await fetch(`/api/admin/members/${memberId}/packages/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalSessions, price, note: editNote }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "수정에 실패했습니다.");
      return;
    }
    setEditingPkgId(null);
    const refreshed = await fetch(`/api/admin/members/${memberId}`).then((r) => r.json());
    setData(refreshed);
    onChanged();
  }

  async function deletePkg(pkgId: number) {
    if (!confirm("이 결제 기록을 삭제할까요?")) return;
    const res = await fetch(`/api/admin/members/${memberId}/packages/${pkgId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("삭제에 실패했습니다.");
      return;
    }
    const refreshed = await fetch(`/api/admin/members/${memberId}`).then((r) => r.json());
    setData(refreshed);
    onChanged();
  }

  const firstPackageId = data.packages[0]?.id;

  return (
    <ModalShell title={`${data.member.name} — 회원 정보`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm">
          진행 {data.progress.doneCount} / {data.progress.totalSessions} (잔여{" "}
          {data.progress.remaining}회)
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

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름 *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
            </Field>
            <Field label="연락처">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="담당 코치">
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              >
                <option value="">미지정</option>
                {activeCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {data.member.coach_id &&
                  !activeCoaches.some((c) => c.id === data.member.coach_id) && (
                    <option value={data.member.coach_id}>
                      {coaches.find((c) => c.id === data.member.coach_id)?.name ?? "알 수 없음"}
                      (퇴사)
                    </option>
                  )}
              </select>
            </Field>
            <Field label="상태">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MemberStatus)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </Field>
          </div>
          <Field label="소개해주신 분">
            <input
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="선택 입력"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
          <Field label="가능한 요일·시간">
            <input
              value={availableTimes}
              onChange={(e) => setAvailableTimes(e.target.value)}
              placeholder="예: 화·목 오전 10시"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </Field>
          <Field label="운동 목적 / 특이사항">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">결제·패키지 이력</p>
          <div className="rounded-xl border border-line/60 divide-y divide-line/40 overflow-hidden mb-2">
            {data.packages.map((pkg) => (
              <div key={pkg.id} className="px-3 py-2 text-xs">
                {editingPkgId === pkg.id ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        value={editTotal}
                        onChange={(e) => setEditTotal(e.target.value)}
                        placeholder="횟수"
                        className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                      />
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="금액"
                        className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                      />
                    </div>
                    <input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="메모"
                      className="w-full rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-coral"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => saveEditPkg(pkg.id)}
                        className="flex-1 rounded-full bg-ink text-white py-1.5 text-xs font-medium hover:bg-coral transition"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingPkgId(null)}
                        className="flex-1 rounded-full border border-line py-1.5 text-xs hover:bg-bone transition"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5">
                        <span className="text-ink/40 whitespace-nowrap">
                          {new Date(pkg.purchased_at).toLocaleDateString("ko-KR")}
                        </span>
                        <TypeBadge isFirst={pkg.id === firstPackageId} />
                      </p>
                      <p className="text-ink/60 truncate">
                        {pkg.total_sessions}회 · 회당 {formatWon(packageRate(pkg))} ·{" "}
                        {formatWon(pkg.price)}
                        {pkg.note && ` · ${pkg.note}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEditPkg(pkg)}
                        className="rounded-full border border-line px-2 py-1 hover:bg-bone transition"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deletePkg(pkg.id)}
                        className="rounded-full border border-line px-2 py-1 text-red-500 hover:bg-red-50 transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data.packages.length === 0 && (
              <p className="px-3 py-3 text-xs text-ink/40">결제 이력이 없어요.</p>
            )}
          </div>
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
          <p className="text-sm font-medium mb-2">최근 세션 기록</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {data.sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex justify-between text-xs text-ink/60">
                <span>
                  {s.session_date} {s.session_hour}:00
                </span>
                <span>
                  {s.status}
                  {Number(s.total_sessions) > 0 ? ` · ${s.ordinal}/${s.total_sessions}` : ""}
                </span>
              </div>
            ))}
            {data.sessions.length === 0 && (
              <p className="text-xs text-ink/40">아직 세션 기록이 없어요.</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleDeleteMember}
            disabled={data.packages.length > 0 || saving}
            title={
              data.packages.length > 0
                ? "결제 이력이 있는 회원은 삭제할 수 없어요. 상태를 '비활성'으로 바꿔주세요."
                : undefined
            }
            className="rounded-full border border-line px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:hover:bg-transparent"
          >
            삭제
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-line py-2 text-sm hover:bg-bone transition"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full bg-ink text-white py-2 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
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
