"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  CoachRow,
  ContractRow,
  MemberStatus,
  PackageRow,
  PaymentMethod,
  PtType,
  VisitChannel,
} from "@/lib/db";
import type { FixedSlotWithMember, MemberWithProgress } from "@/lib/schedule";
import { PURPOSE_OPTIONS, SCHEDULE_HOUR_ROWS } from "@/lib/constants";
import { ContractDocument } from "@/app/components/ContractDocument";
import { SignaturePad } from "@/app/components/SignaturePad";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const PT_TYPE_OPTIONS: PtType[] = ["1:1", "2:1"];
const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["card", "transfer"];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "카드결제",
  transfer: "계좌이체",
};
const FIXED_SLOT_WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토"];
const FIXED_SLOT_CAPACITY = 3;

const VISIT_CHANNEL_OPTIONS: Array<{ value: VisitChannel; label: string }> = [
  { value: "naver", label: "네이버" },
  { value: "instagram", label: "인스타" },
  { value: "flyer", label: "외부 홍보물" },
  { value: "referral", label: "지인" },
  { value: "other", label: "기타" },
];

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

function PtTypeBadge({ ptType }: { ptType: PtType }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        ptType === "2:1" ? "bg-indigo-100 text-indigo-700" : "bg-line/40 text-ink/50",
      ].join(" ")}
    >
      {ptType}
    </span>
  );
}

function GoldenBellBadge() {
  return (
    <span
      title="재등록 골든타임 — 잔여 3회 이하"
      className="rounded-full bg-gold/15 text-gold-deep px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
    >
      🔔 골든벨
    </span>
  );
}

function ReferrerBadge({ referrer }: { referrer: string }) {
  return (
    <span
      title="소개해주신 분"
      className="rounded-full bg-line/40 text-ink/50 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
    >
      소개: {referrer}
    </span>
  );
}

function PtTypeToggle({
  value,
  onChange,
}: {
  value: PtType;
  onChange: (t: PtType) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
      {PT_TYPE_OPTIONS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            "flex-1 rounded-full py-1.5 font-medium transition",
            value === t ? "bg-coral text-white shadow-sm" : "text-ink/60",
          ].join(" ")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-bone/70 p-1 text-sm">
      {PAYMENT_METHOD_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={[
            "flex-1 rounded-full py-1.5 font-medium transition",
            value === m ? "bg-coral text-white shadow-sm" : "text-ink/60",
          ].join(" ")}
        >
          {PAYMENT_METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span
      className={[
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        method === "transfer" ? "bg-sage/20 text-sage" : "bg-line/40 text-ink/50",
      ].join(" ")}
    >
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}

export function MembersView({
  initialMembers,
  coaches,
  initialFixedSlots,
  initialOpenId,
}: {
  initialMembers: MemberWithProgress[];
  coaches: CoachRow[];
  initialFixedSlots: FixedSlotWithMember[];
  initialOpenId?: number | null;
}) {
  const members = initialMembers;
  const fixedSlots = initialFixedSlots;
  const activeCoaches = useMemo(() => coaches.filter((c) => c.active), [coaches]);
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState<number | "all" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(initialOpenId ?? null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (search && !m.name.includes(search)) return false;
      if (coachFilter === "unassigned") {
        if (m.coach_id !== null) return false;
      } else if (coachFilter !== "all" && m.coach_id !== coachFilter) {
        return false;
      }
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
            onChange={(e) => {
              const v = e.target.value;
              setCoachFilter(v === "all" ? "all" : v === "unassigned" ? "unassigned" : Number(v));
            }}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="all">담당 코치 전체</option>
            <option value="unassigned">미지정</option>
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
              const goldenBell = m.status === "active" && m.total_sessions > 0 && remaining <= 3;
              return (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailId(m.id)}
                  onKeyDown={(e) => e.key === "Enter" && setDetailId(m.id)}
                  className="text-left rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3.5 active:bg-bone/40 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-medium flex items-center gap-1.5 flex-wrap">
                      {m.name}
                      {m.total_sessions > 0 && <TypeBadge isFirst={m.package_count < 2} />}
                      {goldenBell && <GoldenBellBadge />}
                      {m.referrer && <ReferrerBadge referrer={m.referrer} />}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/admin/members/${m.id}/assessment`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-full border border-coral text-coral px-2 py-0.5 text-[11px] font-medium hover:bg-coral/5 transition whitespace-nowrap"
                      >
                        평가 기록
                      </Link>
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
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span
                      className={[
                        "flex h-4 w-4 items-center justify-center rounded border",
                        m.has_next_week_session
                          ? "border-sage bg-sage text-white"
                          : "border-line text-transparent",
                      ].join(" ")}
                    >
                      ✓
                    </span>
                    <span className="text-ink/50">다음주 수업 예약</span>
                  </div>
                </div>
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
                  <th className="px-5 py-3 font-medium">초/재</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                  <th className="px-5 py-3 font-medium text-center">다음주</th>
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
                  const goldenBell = m.status === "active" && m.total_sessions > 0 && remaining <= 3;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setDetailId(m.id)}
                      className="border-b border-line/40 last:border-0 hover:bg-bone/40 cursor-pointer transition"
                    >
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.name}
                          {m.referrer && <ReferrerBadge referrer={m.referrer} />}
                          <Link
                            href={`/admin/members/${m.id}/assessment`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-full border border-coral text-coral px-2 py-0.5 text-[11px] font-medium hover:bg-coral/5 transition whitespace-nowrap"
                          >
                            평가 기록
                          </Link>
                        </div>
                      </td>
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
                        <div className="flex items-center gap-1.5">
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
                          {goldenBell && <GoldenBellBadge />}
                        </div>
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
                      <td className="px-5 py-3 text-center">
                        <span
                          className={[
                            "inline-flex h-4 w-4 items-center justify-center rounded border text-xs",
                            m.has_next_week_session
                              ? "border-sage bg-sage text-white"
                              : "border-line text-transparent",
                          ].join(" ")}
                          title={m.has_next_week_session ? "다음주 수업 예약됨" : "다음주 예약 없음"}
                        >
                          ✓
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

      <FixedSlotSchedule
        fixedSlots={fixedSlots}
        coachFilter={coachFilter}
        coachName={
          coachFilter === "all"
            ? null
            : coachFilter === "unassigned"
              ? "미지정"
              : coaches.find((c) => c.id === coachFilter)?.name ?? null
        }
      />

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

      {detailId &&
        (() => {
          const detailMember = members.find((m) => m.id === detailId);
          if (!detailMember) return null;
          return (
            <MemberDetailModal
              memberId={detailId}
              initialMember={detailMember}
              coaches={coaches}
              activeCoaches={activeCoaches}
              fixedSlots={fixedSlots.filter((f) => f.member_id === detailId)}
              onClose={() => setDetailId(null)}
              onChanged={refresh}
            />
          );
        })()}
    </div>
  );
}

function FixedSlotSchedule({
  fixedSlots,
  coachFilter,
  coachName,
}: {
  fixedSlots: FixedSlotWithMember[];
  coachFilter: number | "all" | "unassigned";
  coachName: string | null;
}) {
  const scopedSlots = useMemo(() => {
    if (coachFilter === "all") return fixedSlots;
    if (coachFilter === "unassigned") {
      return fixedSlots.filter((slot) => slot.member_coach_id === null);
    }
    return fixedSlots.filter((slot) => slot.member_coach_id === coachFilter);
  }, [fixedSlots, coachFilter]);

  const byCell = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of scopedSlots) {
      const key = `${slot.weekday}-${slot.hour}`;
      const names = map.get(key) ?? [];
      names.push(slot.member_name);
      map.set(key, names);
    }
    return map;
  }, [scopedSlots]);

  const hourTotals = useMemo(() => {
    const totals = new Map<number, number>();
    for (const slot of scopedSlots) {
      totals.set(slot.hour, (totals.get(slot.hour) ?? 0) + 1);
    }
    return totals;
  }, [scopedSlots]);

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-display text-lg">
          {coachName ? `${coachName} 코치 고정 회원 시간표` : "고정 회원 시간표"}
        </p>
        <span className="text-xs text-ink/40">시간대별 고정 회원 배정 현황</span>
      </div>
      <p className="text-xs text-ink/40 mb-3">
        한 시간대에 일주일 합계 {FIXED_SLOT_CAPACITY}명을 초과하면 붉은색으로 표시돼요.
      </p>
      <div className="rounded-2xl bg-white border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-xs min-w-[720px] border-collapse">
          <thead>
            <tr className="text-left text-ink/50 border-b border-line/60">
              <th className="px-3 py-2.5 font-medium w-14">시간</th>
              {FIXED_SLOT_WEEKDAY_LABELS.map((label) => (
                <th key={label} className="px-3 py-2.5 font-medium text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_HOUR_ROWS.map((hour) => {
              const over = (hourTotals.get(hour) ?? 0) > FIXED_SLOT_CAPACITY;
              return (
              <tr key={hour} className="border-b border-line/30 last:border-0">
                <td className="px-3 py-2.5 text-ink/50 whitespace-nowrap">{hour}시</td>
                {FIXED_SLOT_WEEKDAY_LABELS.map((_, weekday) => {
                  const names = byCell.get(`${weekday}-${hour}`) ?? [];
                  return (
                    <td key={weekday} className="px-3 py-2.5 align-top">
                      {names.length > 0 && (
                        <div
                          className={[
                            "flex flex-wrap gap-1 rounded-lg px-1.5 py-1",
                            over ? "bg-red-50" : "",
                          ].join(" ")}
                        >
                          {names.map((name, i) => (
                            <span
                              key={`${name}-${i}`}
                              className={[
                                "rounded-full px-1.5 py-0.5 whitespace-nowrap",
                                over ? "bg-red-100 text-red-600" : "bg-sage/15 text-ink/70",
                              ].join(" ")}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractFieldsFieldset({
  rrnFront,
  onRrnFrontChange,
  address,
  onAddressChange,
  visitChannel,
  onVisitChannelChange,
  visitChannelReferrerName,
  onVisitChannelReferrerNameChange,
  purposes,
  onTogglePurpose,
  purposeOther,
  onPurposeOtherChange,
  startDate,
  onStartDateChange,
  optionNote,
  onOptionNoteChange,
  privacyConsent,
  onPrivacyConsentChange,
  showVisitChannelAndPurpose = true,
}: {
  rrnFront: string;
  onRrnFrontChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  visitChannel: VisitChannel;
  onVisitChannelChange: (v: VisitChannel) => void;
  visitChannelReferrerName: string;
  onVisitChannelReferrerNameChange: (v: string) => void;
  purposes: string[];
  onTogglePurpose: (v: string) => void;
  purposeOther: string;
  onPurposeOtherChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  optionNote: string;
  onOptionNoteChange: (v: string) => void;
  privacyConsent: boolean;
  onPrivacyConsentChange: (v: boolean) => void;
  /** 초진 문진표에서 이미 수집하는 회원 등록 흐름에서는 방문경로/운동 목표를 숨긴다. */
  showVisitChannelAndPurpose?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="주민등록번호 (앞자리)">
          <input
            value={rrnFront}
            onChange={(e) => onRrnFrontChange(e.target.value)}
            placeholder="예: 900101"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="주소">
          <input
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
      </div>
      {showVisitChannelAndPurpose && (
        <>
          <Field label="방문 경로">
            <div className="flex flex-wrap gap-1.5">
              {VISIT_CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onVisitChannelChange(opt.value)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                    visitChannel === opt.value
                      ? "bg-coral text-white border-coral"
                      : "border-line text-ink/60 hover:bg-bone",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {visitChannel === "referral" && (
              <input
                value={visitChannelReferrerName}
                onChange={(e) => onVisitChannelReferrerNameChange(e.target.value)}
                placeholder="소개해주신 분 이름"
                className="w-full mt-2 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
              />
            )}
          </Field>
          <Field label="운동 목표">
            <div className="flex flex-wrap gap-1.5">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTogglePurpose(opt.value)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                    purposes.includes(opt.value)
                      ? "bg-coral text-white border-coral"
                      : "border-line text-ink/60 hover:bg-bone",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              value={purposeOther}
              onChange={(e) => onPurposeOtherChange(e.target.value)}
              placeholder="기타 (선택 입력)"
              className="w-full mt-2 rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
            />
          </Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="운동 시작일">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
        <Field label="옵션">
          <input
            value={optionNote}
            onChange={(e) => onOptionNoteChange(e.target.value)}
            placeholder="선택 입력"
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={privacyConsent}
          onChange={(e) => onPrivacyConsentChange(e.target.checked)}
        />
        개인정보(민감정보 포함) 수집·이용에 동의합니다.
      </label>
    </>
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
  const [ptType, setPtType] = useState<PtType>("1:1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [totalSessions, setTotalSessions] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 계약서 전용 항목
  const [rrnFront, setRrnFront] = useState("");
  const [address, setAddress] = useState("");
  const [visitChannel, setVisitChannel] = useState<VisitChannel>("");
  const [visitChannelReferrerName, setVisitChannelReferrerName] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [purposeOther, setPurposeOther] = useState("");
  const [optionNote, setOptionNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  function togglePurpose(value: string) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

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
          ptType,
          paymentMethod,
          rrnFront,
          address,
          visitChannel,
          visitChannelReferrerName,
          purposes,
          purposeOther,
          optionNote,
          startDate,
          privacyConsent,
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
        <Field label="PT 유형">
          <PtTypeToggle value={ptType} onChange={setPtType} />
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
        <Field label="결제 수단">
          <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
        </Field>
        <Field label="운동 목적 / 특이사항">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-coral resize-none"
          />
        </Field>

        <div className="border-t border-line/60 pt-4 space-y-4">
          <p className="text-sm font-medium text-ink/70">계약서 정보</p>
          <ContractFieldsFieldset
            rrnFront={rrnFront}
            onRrnFrontChange={setRrnFront}
            address={address}
            onAddressChange={setAddress}
            visitChannel={visitChannel}
            onVisitChannelChange={setVisitChannel}
            visitChannelReferrerName={visitChannelReferrerName}
            onVisitChannelReferrerNameChange={setVisitChannelReferrerName}
            purposes={purposes}
            onTogglePurpose={togglePurpose}
            purposeOther={purposeOther}
            onPurposeOtherChange={setPurposeOther}
            startDate={startDate}
            onStartDateChange={setStartDate}
            optionNote={optionNote}
            onOptionNoteChange={setOptionNote}
            privacyConsent={privacyConsent}
            onPrivacyConsentChange={setPrivacyConsent}
            showVisitChannelAndPurpose={false}
          />
        </div>

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

function WriteContractModal({
  memberId,
  latestPackage,
  onClose,
  onCreated,
}: {
  memberId: number;
  latestPackage: PackageRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rrnFront, setRrnFront] = useState("");
  const [address, setAddress] = useState("");
  const [visitChannel, setVisitChannel] = useState<VisitChannel>("");
  const [visitChannelReferrerName, setVisitChannelReferrerName] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [purposeOther, setPurposeOther] = useState("");
  const [optionNote, setOptionNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePurpose(value: string) {
    setPurposes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rrnFront,
          address,
          visitChannel,
          visitChannelReferrerName,
          purposes,
          purposeOther,
          optionNote,
          startDate,
          privacyConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "계약서 작성에 실패했습니다.");
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
    <ModalShell title="계약서 작성" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm">
          <p className="text-xs text-ink/50 mb-1">회원권 정보 (최근 패키지 자동 반영)</p>
          <p>
            {latestPackage.pt_type} · {latestPackage.total_sessions}회 ·{" "}
            {formatWon(latestPackage.price)} · {PAYMENT_METHOD_LABELS[latestPackage.payment_method]}
          </p>
        </div>
        <ContractFieldsFieldset
          rrnFront={rrnFront}
          onRrnFrontChange={setRrnFront}
          address={address}
          onAddressChange={setAddress}
          visitChannel={visitChannel}
          onVisitChannelChange={setVisitChannel}
          visitChannelReferrerName={visitChannelReferrerName}
          onVisitChannelReferrerNameChange={setVisitChannelReferrerName}
          purposes={purposes}
          onTogglePurpose={togglePurpose}
          purposeOther={purposeOther}
          onPurposeOtherChange={setPurposeOther}
          startDate={startDate}
          onStartDateChange={setStartDate}
          optionNote={optionNote}
          onOptionNoteChange={setOptionNote}
          privacyConsent={privacyConsent}
          onPrivacyConsentChange={setPrivacyConsent}
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-ink text-white py-2.5 font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "계약서 작성 완료"}
        </button>
      </div>
    </ModalShell>
  );
}

function ContractViewModal({
  memberId,
  onClose,
  onSigned,
}: {
  memberId: number;
  onClose: () => void;
  onSigned?: () => void;
}) {
  const [data, setData] = useState<{
    member: { name: string; phone: string };
    contract: ContractRow & { rrn_front: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/members/${memberId}/contract`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(d.error ?? "계약서를 불러오지 못했어요.");
          return;
        }
        setData(d);
      })
      .catch(() => setError("네트워크 오류가 발생했어요."));
  }

  useEffect(load, [memberId]);

  function handleSigned() {
    load();
    onSigned?.();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl p-6 sm:p-10 my-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">계약서</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        {!data && !error && <p className="text-sm text-ink/50">불러오는 중...</p>}
        {data && (
          <ContractDocument
            memberName={data.member.name}
            memberPhone={data.member.phone}
            contract={data.contract}
          >
            {data.contract.signed_at ? (
              <div className="rounded-2xl border border-sage/40 bg-sage/10 px-6 py-6">
                <p className="font-display text-lg mb-3">회원 서명</p>
                {data.contract.signature_data_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.contract.signature_data_url}
                    alt="회원 서명"
                    className="h-32 rounded-lg border border-line bg-white"
                  />
                )}
                <p className="text-xs text-ink/50 mt-2">
                  {formatDateTime(data.contract.signed_at)} 서명 완료
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-ink/50 mb-3">
                  아직 서명 전이에요. 회원이 매장에 방문했다면 아래에서 바로 서명받을 수
                  있고, 회원 개인 페이지에서 직접 서명할 수도 있어요.
                </p>
                <SignaturePad
                  signUrl={`/api/admin/members/${memberId}/contract/sign`}
                  onSigned={handleSigned}
                />
              </div>
            )}
          </ContractDocument>
        )}
      </div>
    </div>
  );
}

function MemberDetailModal({
  memberId,
  initialMember,
  coaches,
  activeCoaches,
  fixedSlots,
  onClose,
  onChanged,
}: {
  memberId: number;
  initialMember: MemberWithProgress;
  coaches: CoachRow[];
  activeCoaches: CoachRow[];
  fixedSlots: FixedSlotWithMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newSlotWeekday, setNewSlotWeekday] = useState(0);
  const [newSlotHour, setNewSlotHour] = useState(SCHEDULE_HOUR_ROWS[0]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [showWriteContract, setShowWriteContract] = useState(false);
  const [showContractView, setShowContractView] = useState(false);

  async function addSlot() {
    if (!data?.member.coach_id) {
      setSlotError("담당 코치를 먼저 지정해주세요.");
      return;
    }
    setSavingSlot(true);
    setSlotError(null);
    try {
      const res = await fetch("/api/admin/fixed-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, weekday: newSlotWeekday, hour: newSlotHour }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSlotError(d.error ?? "추가에 실패했습니다.");
        return;
      }
      const created = d.created ?? 0;
      const skippedDates: string[] = d.skippedDates ?? [];
      if (created > 0 || skippedDates.length > 0) {
        let message = created > 0 ? `스케줄표에 ${created}건 자동 예약됐어요.` : "";
        if (skippedDates.length > 0) {
          message +=
            (message ? "\n" : "") +
            `${skippedDates.length}건은 이미 다른 예약이 있어 건너뛰었어요: ${skippedDates.join(", ")}`;
        }
        alert(message);
      }
      onChanged();
    } finally {
      setSavingSlot(false);
    }
  }

  async function removeSlot(id: number) {
    await fetch(`/api/admin/fixed-slots/${id}`, { method: "DELETE" });
    onChanged();
  }
  // 목록에서 이미 알고 있는 회원 기본 정보(이름·연락처·담당·상태·소개자·가능시간·메모·개인
  // 예약 링크)는 곧바로 채워 넣어, 모달을 열자마자 편집 폼이 보이게 한다. 목록에는 없는
  // 패키지·세션·계약서·평가 기록 요약만 아래 useEffect의 백그라운드 조회로 채운다.
  const [data, setData] = useState<{
    member: MemberDetail;
    progress: { totalSessions: number; doneCount: number; remaining: number };
    packages: PackageRow[];
    sessions: SessionSummary[];
    contract: { id: number; entryType: string; signedAt: string | null } | null;
    assessmentSummary: { count: number; latestAt: string | null };
  }>({
    member: initialMember,
    progress: {
      totalSessions: initialMember.total_sessions,
      doneCount: initialMember.done_count,
      remaining: initialMember.total_sessions - initialMember.done_count,
    },
    packages: [],
    sessions: [],
    contract: null,
    assessmentSummary: { count: 0, latestAt: null },
  });
  const [detailLoading, setDetailLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [addSessions, setAddSessions] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addPtType, setAddPtType] = useState<PtType>("1:1");
  const [addPaymentMethod, setAddPaymentMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 편집 폼 상태 — 이미 목록에 있는 값으로 즉시 초기화한다.
  const [name, setName] = useState(initialMember.name);
  const [phone, setPhone] = useState(initialMember.phone);
  const [coachId, setCoachId] = useState<number | "">(initialMember.coach_id ?? "");
  const [status, setStatus] = useState<MemberStatus>(initialMember.status);
  const [referrer, setReferrer] = useState(initialMember.referrer);
  const [availableTimes, setAvailableTimes] = useState(initialMember.available_times);
  const [notes, setNotes] = useState(initialMember.notes);

  const [editingPkgId, setEditingPkgId] = useState<number | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPtType, setEditPtType] = useState<PtType>("1:1");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("card");

  // 이름/연락처 등 편집 폼 값은 이미 목록에서 받은 값으로 채워둔 상태라 여기서 다시 덮어쓰지
  // 않는다(관리자가 응답이 오기 전에 입력을 시작했다면 그 값을 유지하기 위함) — 패키지·세션·
  // 계약서·평가 기록 요약만 이 응답으로 채운다.
  useEffect(() => {
    fetch(`/api/admin/members/${memberId}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setDetailLoading(false));
  }, [memberId]);

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
      body: JSON.stringify({
        totalSessions: Number(addSessions),
        price: Number(addPrice || 0),
        ptType: addPtType,
        paymentMethod: addPaymentMethod,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "추가에 실패했습니다.");
      return;
    }
    setAddSessions("");
    setAddPrice("");
    setAddPtType("1:1");
    setAddPaymentMethod("card");
    onChanged();
    onClose();
  }

  function startEditPkg(pkg: PackageRow) {
    setEditingPkgId(pkg.id);
    setEditTotal(String(pkg.total_sessions));
    setEditPrice(String(pkg.price));
    setEditNote(pkg.note);
    setEditPtType(pkg.pt_type);
    setEditPaymentMethod(pkg.payment_method);
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
      body: JSON.stringify({
        totalSessions,
        price,
        note: editNote,
        ptType: editPtType,
        paymentMethod: editPaymentMethod,
      }),
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
  const latestPackage = data.packages[data.packages.length - 1];

  return (
    <>
    <ModalShell title={`${data.member.name} — 회원 정보`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span>
            진행 {data.progress.doneCount} / {data.progress.totalSessions} (잔여{" "}
            {data.progress.remaining}회)
          </span>
          {data.contract ? (
            <button
              onClick={() => setShowContractView(true)}
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition hover:opacity-80",
                data.contract.signedAt ? "bg-sage/20 text-sage" : "bg-coral/10 text-coral",
              ].join(" ")}
            >
              계약서 {data.contract.signedAt ? "서명완료" : "서명대기"} · 보기
            </button>
          ) : (
            data.packages.length > 0 && (
              <button
                onClick={() => setShowWriteContract(true)}
                className="rounded-full border border-coral text-coral px-2.5 py-0.5 text-xs font-medium hover:bg-coral/5 transition whitespace-nowrap"
              >
                + 계약서 작성
              </button>
            )
          )}
        </div>

        <div className="rounded-xl bg-bone/50 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span>
            체형 평가{" "}
            {detailLoading
              ? "불러오는 중..."
              : data.assessmentSummary.count > 0
                ? `${data.assessmentSummary.count}건 · 최근 ${data.assessmentSummary.latestAt}`
                : "기록 없음"}
          </span>
          <Link
            href={`/admin/members/${memberId}/assessment`}
            className="rounded-full border border-coral text-coral px-2.5 py-0.5 text-xs font-medium hover:bg-coral/5 transition whitespace-nowrap"
          >
            {data.assessmentSummary.count > 0 ? "평가 기록" : "+ 평가 작성"}
          </Link>
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
          <p className="text-sm font-medium mb-2">고정 시간대</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {fixedSlots.length === 0 && (
              <p className="text-xs text-ink/40">등록된 고정 시간대가 없어요.</p>
            )}
            {fixedSlots.map((slot) => (
              <span
                key={slot.id}
                className="flex items-center gap-1 rounded-full bg-bone/70 px-2.5 py-1 text-xs"
              >
                {FIXED_SLOT_WEEKDAY_LABELS[slot.weekday] ?? "?"} {slot.hour}시
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="text-ink/40 hover:text-coral"
                  aria-label="삭제"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={newSlotWeekday}
              onChange={(e) => setNewSlotWeekday(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {FIXED_SLOT_WEEKDAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={newSlotHour}
              onChange={(e) => setNewSlotHour(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none"
            >
              {SCHEDULE_HOUR_ROWS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}시
                </option>
              ))}
            </select>
            <button
              onClick={addSlot}
              disabled={savingSlot}
              className="flex-1 rounded-lg border border-coral text-coral text-sm font-medium hover:bg-coral/5 transition disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {slotError && <p className="text-xs text-coral mt-1">{slotError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">결제·패키지 이력</p>
          <div className="rounded-xl border border-line/60 divide-y divide-line/40 overflow-hidden mb-2">
            {data.packages.map((pkg) => (
              <div key={pkg.id} className="px-3 py-2 text-xs">
                {editingPkgId === pkg.id ? (
                  <div className="space-y-1.5">
                    <PtTypeToggle value={editPtType} onChange={setEditPtType} />
                    <PaymentMethodToggle value={editPaymentMethod} onChange={setEditPaymentMethod} />
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
                        <PtTypeBadge ptType={pkg.pt_type} />
                        <PaymentMethodBadge method={pkg.payment_method} />
                      </p>
                      <p className="text-ink/60 truncate">
                        {pkg.total_sessions}회 · {formatWon(pkg.price)}
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
          <PtTypeToggle value={addPtType} onChange={setAddPtType} />
          <div className="mt-1.5">
            <PaymentMethodToggle value={addPaymentMethod} onChange={setAddPaymentMethod} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
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
    {showWriteContract && latestPackage && (
      <WriteContractModal
        memberId={memberId}
        latestPackage={latestPackage}
        onClose={() => setShowWriteContract(false)}
        onCreated={() => {
          setShowWriteContract(false);
          onChanged();
          onClose();
        }}
      />
    )}
    {showContractView && (
      <ContractViewModal
        memberId={memberId}
        onClose={() => setShowContractView(false)}
        onSigned={() =>
          setData((prev) =>
            prev.contract
              ? { ...prev, contract: { ...prev.contract, signedAt: new Date().toISOString() } }
              : prev,
          )
        }
      />
    )}
    </>
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
