import { PulseLine } from "@/app/components/PulseLine";
import { ReservationForm } from "@/app/components/ReservationForm";
import { getTakenSlots } from "@/lib/reservations";

// 예약 현황(DB)에 따라 매 요청마다 달라지므로 정적 프리렌더링을 끈다.
export const dynamic = "force-dynamic";

const CREDIBILITY_POINTS = [
  {
    title: "전 직원 물리치료사",
    body: "트레이너가 아닌 물리치료사가 회원님의 몸 상태를 먼저 살피고, 그에 맞는 운동을 처방합니다.",
  },
  {
    title: "1:1 맞춤 처방",
    body: "재활, 체형교정, 다이어트, 근력 증진, 성장기 관리까지 — 목적에 맞는 방식으로 함께합니다.",
  },
  {
    title: "나아지는 기록",
    body: "매 세션의 변화를 함께 기록하고 조율하며, 몸과 마음이 함께 신나지는 경험을 설계합니다.",
  },
];

export default async function Home() {
  const initialTaken = await getTakenSlots();

  return (
    <>
      <header className="bg-ink text-bone">
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <p className="text-sm tracking-[0.2em] text-sage uppercase mb-6">
            Pre-Open Reservation
          </p>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.25] mb-8">
            신나게 나아지는 몸,
            <br />
            신나아짐에서 시작합니다
          </h1>
          <p className="max-w-xl text-bone/80 leading-relaxed mb-12">
            물리치료사가 설계하는 프리미엄 PT, 신나아짐이 곧 문을 엽니다.
            오픈에 앞서 가장 먼저 예약하고 첫 회원이 되어주세요.
          </p>
          <PulseLine className="w-full max-w-xl h-16 text-coral" />
          <a
            href="#reserve"
            className="inline-block mt-12 rounded-full bg-coral text-bone px-8 py-3.5 font-medium tracking-wide hover:opacity-90 transition"
          >
            사전예약 하러 가기
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-20 grid gap-10 sm:grid-cols-3">
          {CREDIBILITY_POINTS.map((point) => (
            <div key={point.title}>
              <div className="w-8 h-px bg-coral mb-4" />
              <h2 className="font-display text-lg mb-2">{point.title}</h2>
              <p className="text-sm text-ink/70 leading-relaxed">{point.body}</p>
            </div>
          ))}
        </section>

        <section id="reserve" className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-sm tracking-[0.2em] text-coral uppercase mb-3">Reservation</p>
            <h2 className="font-display text-3xl mb-3">사전예약 안내</h2>
            <p className="text-ink/70 mb-12 leading-relaxed">
              아래 달력에서 원하시는 날짜와 시간을 선택해주세요. 예약은 오전 9시부터
              오후 10시까지 1시간 단위로 가능하며, 한 시간에 한 분만 예약하실 수
              있어요. 예약이 확정되면 남겨주신 연락처로 안내드릴게요.
            </p>
            <ReservationForm initialTaken={initialTaken} />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-ink/60 flex flex-col gap-2">
          <p className="font-display text-base text-ink">신나아짐</p>
          <p>전 직원 물리치료사 · 프리미엄 PT 스튜디오</p>
          <p>문의 · 010-6856-6114</p>
          <p>정확한 위치와 오픈일은 사전예약해주신 분들께 가장 먼저 안내드릴게요.</p>
        </div>
      </footer>
    </>
  );
}
