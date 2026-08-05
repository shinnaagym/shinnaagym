import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  computeMemberProgress,
  getCoachAvailability,
  getMemberByToken,
  listCoaches,
  listMemberSessions,
} from "@/lib/schedule";
import { getLatestContractByMember } from "@/lib/contracts";
import { listAssessmentsByMember } from "@/lib/assessments";
import { listPtLogsByMember } from "@/lib/pt-logs";
import { listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { getIntakeQuestionnaireByMember } from "@/lib/intake";
import { listGoalMemosByMember } from "@/lib/goal-memos";
import { listNotices } from "@/lib/notices";
import { koreaTodayKey } from "@/lib/date";
import { AssessmentPainChart } from "@/app/admin/members/[id]/assessment/pain-chart";
import { ExercisePerformanceChart } from "@/app/components/ExercisePerformanceChart";
import { PtLogDisclosureCard } from "./pt-log-disclosure-card";

// 담당 코치의 개인 연락처가 등록되지 않은 경우를 위한 기본(스튜디오) 문의 번호.
const DEFAULT_STUDIO_PHONE = "010-6859-6114";

const STATUS_LABEL: Record<string, string> = {
  reserved: "예약",
  no_show: "노쇼",
  cancelled: "취소",
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) return {};

  const title = `${member.name}님의 예약 사이트`;
  return {
    title,
    openGraph: { title },
  };
}

export default async function MyReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const [
    progress,
    sessions,
    availability,
    coaches,
    contract,
    assessments,
    ptLogs,
    personalExercises,
    intake,
    notices,
    goalMemos,
  ] = await Promise.all([
    computeMemberProgress(member.id),
    listMemberSessions(member.id),
    member.coach_id
      ? getCoachAvailability(member.coach_id, koreaTodayKey(), 14)
      : Promise.resolve([]),
    listCoaches(),
    getLatestContractByMember(member.id),
    listAssessmentsByMember(member.id),
    listPtLogsByMember(member.id),
    listPersonalExercisesByMember(member.id),
    getIntakeQuestionnaireByMember(member.id),
    listNotices(),
    listGoalMemosByMember(member.id),
  ]);

  // 제목이 비어있지 않은(=실제로 내용을 입력한) 항목만 회원 화면에 노출한다.
  const activeNotices = notices.filter((n) => n.category === "notice" && n.title.trim());
  const activeEvents = notices.filter((n) => n.category === "event" && n.title.trim());

  const contactPhone =
    coaches.find((c) => c.id === member.coach_id)?.phone.trim() || DEFAULT_STUDIO_PHONE;

  const today = koreaTodayKey();
  const upcoming = sessions
    .filter((s) => s.session_date >= today && s.status !== "cancelled")
    .sort((a, b) =>
      a.session_date === b.session_date
        ? a.session_hour - b.session_hour
        : a.session_date.localeCompare(b.session_date),
    );
  const past = sessions.filter((s) => s.session_date < today || s.status === "cancelled");

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <div className="flex items-center gap-2 mb-10">
          <Image src="/logo.png" alt="신나아짐" width={271} height={341} className="h-8 w-auto" />
          <span className="font-display text-lg">신나아짐</span>
        </div>

        <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">My Reservation</p>
        <h1 className="font-serif-display text-3xl mb-8">{member.name}님의 예약</h1>

        {(activeNotices.length > 0 || activeEvents.length > 0) && (
          <div className="space-y-4 mb-10">
            {activeEvents.length > 0 && (
              <section className="rounded-2xl border border-gold/30 bg-gold/5 px-6 py-5">
                <p className="font-display text-lg mb-3">🎉 진행 중인 이벤트</p>
                <ul className="space-y-3">
                  {activeEvents.map((n) => (
                    <li key={n.id}>
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.content && (
                        <p className="text-sm text-ink/60 mt-1 whitespace-pre-wrap">
                          {n.content}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {activeNotices.length > 0 && (
              <section className="rounded-2xl border border-line bg-white/60 px-6 py-5">
                <p className="font-display text-lg mb-3">📢 공지사항</p>
                <ul className="space-y-3">
                  {activeNotices.map((n) => (
                    <li key={n.id}>
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.content && (
                        <p className="text-sm text-ink/60 mt-1 whitespace-pre-wrap">
                          {n.content}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {progress.totalSessions > 0 && progress.remaining <= 3 && (
          <div className="rounded-2xl bg-gold/10 border border-gold/30 px-6 py-5 mb-10">
            <p className="font-display text-lg mb-2">🔔 재등록 골든타임</p>
            <p className="text-sm text-ink/70 leading-relaxed mb-4">
              잔여 세션이 얼마 남지 않았어요. 지금 재등록하시면 재등록 할인 5%와 50분 마사지
              1회를 무료로 드려요!
            </p>
            <a
              href={`tel:${contactPhone}`}
              className="inline-block rounded-full bg-gold text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              🔔 지금 재등록 문의하기 · {contactPhone}
            </a>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-white/60 px-6 py-5 mb-10">
          <p className="text-sm text-ink/60 mb-1">진행 / 잔여</p>
          <p className="text-2xl font-display">
            {progress.doneCount} / {progress.totalSessions}
            <span className="text-base text-ink/50 font-body ml-3">
              잔여 {progress.remaining}회
            </span>
          </p>
        </div>

        {assessments.length > 0 && (
          <>
            <AssessmentPainChart assessments={assessments} />
            <ExercisePerformanceChart assessments={assessments} />
          </>
        )}

        {ptLogs.length > 0 && <PtLogDisclosureCard ptLogs={ptLogs} />}

        <Link
          href={`/my/${token}/personal-exercise`}
          className="block rounded-2xl border border-line bg-white/60 px-6 py-5 mb-4 hover:border-coral/40 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg mb-1">🏃 개인 운동</p>
              <p className="text-sm text-ink/60">
                {personalExercises.length > 0
                  ? `${personalExercises.length}건 · 내용 확인하기`
                  : "직접 기록해보세요"}
              </p>
            </div>
            <span className="text-ink/30">→</span>
          </div>
        </Link>

        {intake && (
          <Link
            href={`/my/${token}/intake`}
            className="block rounded-2xl border border-line bg-white/60 px-6 py-5 mb-4 hover:border-coral/40 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg mb-1">📋 초진 문진표</p>
                <p className="text-sm text-ink/60">내용 확인하기</p>
              </div>
              <span className="text-ink/30">→</span>
            </div>
          </Link>
        )}

        {goalMemos.length > 0 && (
          <section className="rounded-2xl border border-line bg-white/60 px-6 py-5 mb-4">
            <p className="font-display text-lg mb-3">🎯 목표</p>
            <ul className="space-y-3">
              {goalMemos.map((memo) => (
                <li key={memo.id}>
                  <p className="text-sm whitespace-pre-wrap break-words">{memo.content}</p>
                  <p className="text-xs text-ink/40 mt-0.5">
                    {new Date(memo.created_at).toLocaleDateString("ko-KR", {
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {assessments.length > 0 && (
          <Link
            href={`/my/${token}/assessment`}
            className="block rounded-2xl border border-line bg-white/60 px-6 py-5 mb-10 hover:border-coral/40 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg mb-1">🧍 신체 평가지</p>
                <p className="text-sm text-ink/60">{assessments.length}건 · 내용 확인하기</p>
              </div>
              <span className="text-ink/30">→</span>
            </div>
          </Link>
        )}

        <section className="mb-12">
          <h2 className="font-display text-xl mb-4">다가오는 예약</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink/50">예정된 예약이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm"
                >
                  <span>
                    {s.session_date} ({weekdayOf(s.session_date)}) {s.session_hour}:00
                  </span>
                  <span className="text-coral font-medium">{STATUS_LABEL[s.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-12">
          <h2 className="font-display text-xl mb-1">담당 선생님 가능 시간</h2>
          <p className="text-xs text-ink/50 mb-4">
            앞으로 2주간(다음 주까지)의 시간표예요. 다른 회원님의 예약 내용은 표시되지 않아요.
          </p>
          <div className="space-y-2">
            {availability.map((day) => (
              <div
                key={day.date}
                className="rounded-xl border border-line px-4 py-3 text-sm"
              >
                <p className="font-medium mb-2">
                  {day.date} ({weekdayOf(day.date)})
                </p>
                {day.closed ? (
                  <p className="text-ink/40 text-xs">휴무</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {day.slots.map((slot) => (
                      <span
                        key={slot.hour}
                        className={[
                          "rounded-full px-2.5 py-1 text-xs",
                          slot.available
                            ? "bg-sage/15 text-sage"
                            : "bg-line/40 text-ink/30 line-through",
                        ].join(" ")}
                      >
                        {slot.hour}:00
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {past.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-4">지난 기록</h2>
            <ul className="space-y-1.5">
              {past.slice(0, 10).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-xs text-ink/50 px-1"
                >
                  <span>
                    {s.session_date} {s.session_hour}:00
                  </span>
                  <span>{STATUS_LABEL[s.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {contract && (
          <Link
            href={`/my/${token}/contract`}
            className="block rounded-2xl border border-line bg-white/60 px-6 py-5 mb-10 hover:border-coral/40 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg mb-1">📄 계약서</p>
                <p className="text-sm text-ink/60">
                  {contract.signed_at ? "서명 완료 · 내용 확인하기" : "서명이 필요해요"}
                </p>
              </div>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
                  contract.signed_at ? "bg-sage/20 text-sage" : "bg-coral/10 text-coral",
                ].join(" ")}
              >
                {contract.signed_at ? "서명완료" : "서명대기"}
              </span>
            </div>
          </Link>
        )}

        <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm leading-relaxed">
          <p className="font-medium mb-1">예약 변경·취소 안내</p>
          <p className="text-bone/70">
            예약 변경이나 취소는 이 페이지에서 직접 하실 수 없어요. 담당 선생님께 전화나
            메시지로 먼저 알려주시면 조율해드릴게요.
          </p>
          <p className="mt-2 text-bone/70">문의 · {contactPhone}</p>
        </div>
      </div>
    </main>
  );
}
