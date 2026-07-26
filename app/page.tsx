import Image from "next/image";
import { PulseLine } from "@/app/components/PulseLine";
import { ReservationForm } from "@/app/components/ReservationForm";
import { Reveal } from "@/app/components/Reveal";
import { getTakenSlots } from "@/lib/reservations";

// 예약 현황(DB)에 따라 매 요청마다 달라지므로 정적 프리렌더링을 끈다.
export const dynamic = "force-dynamic";

const TRAINER_NAME = "신종수";
const TRAINER_BIO =
  "청주·파주·서울의 재활의학과와 정형외과에서 임상 경험을 쌓아온 물리치료사입니다. " +
  "근골격계·스포츠 재활, 도수치료, 만성통증 관리까지 폭넓게 교육을 이수하며 몸의 문제를 " +
  "근본부터 짚어내는 방식을 고민해왔습니다. 신나아짐에서는 그 경험을 바탕으로 회원님 " +
  "한 분 한 분에게 맞는 운동을 처방합니다.";

const TRAINER_QUALIFICATIONS = ["보건복지부 물리치료사 면허", "생활체육지도자 보디빌딩 2급"];

const TRAINER_CAREER = [
  "前 청주 연세재활의학과 물리치료사",
  "前 파주 야당연세정형외과 물리치료사",
  "前 서울 랄라짐 트레이너",
  "前 청주 서울드림정형외과 물리치료사",
  "前 오송 퍼스트피지오짐 팀장",
];

const TRAINER_EDUCATION = [
  "근골격계 재활 전문가(MRS) 교육 이수",
  "근신경계 기능적 재교육(NFR) 교육 이수",
  "운동분석 기반 근골격계 관리 솔루션(KEMA) 교육 이수",
  "스포츠 재활 운동 교육(Sport Physio) 이수",
  "근골격계 및 스포츠 재활(Personal Physio) 교육 이수",
  "도수치료 및 카이로프랙틱(MTA) 교육 이수",
  "만성통증 중재 교육(Hello Pain) 이수",
  "러닝 피지오 교육 이수",
];

const STUDIO_ADDRESS = "충청북도 청주시 흥덕구 서현로32 210,211호";

// 실제 내원 순서 그대로 — 순서 자체가 정보라 번호를 붙일 근거가 있다.
const PROCESS_STEPS = [
  {
    n: "01",
    title: "상담",
    body: "어떤 불편함이 있는지, 무엇을 원하시는지 먼저 충분히 듣습니다.",
  },
  {
    n: "02",
    title: "평가",
    body: "자세, 가동범위, 통증 부위를 물리치료사가 직접 확인합니다.",
  },
  {
    n: "03",
    title: "처방",
    body: "검사 결과를 바탕으로 지금 이 몸에 필요한 운동만 설계합니다.",
  },
  {
    n: "04",
    title: "기록",
    body: "매 세션의 변화를 기록하고, 처방을 계속 조율해 나갑니다.",
  },
];

export default async function Home() {
  const initialTaken = await getTakenSlots();

  return (
    <>
      <header className="relative overflow-hidden bg-ink text-bone">
        <div
          aria-hidden="true"
          className="energy-glow pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-gold/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-8 sm:pt-10">
          <a href="#" className="hero-fade-1 inline-flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="신나아짐 로고"
              width={271}
              height={341}
              priority
              className="h-9 w-auto sm:h-10"
            />
            <span className="font-display text-lg sm:text-xl tracking-wide text-bone">
              신나아짐
            </span>
          </a>
        </div>
        <div className="relative mx-auto max-w-5xl px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
          <p className="hero-fade-1 text-sm tracking-[0.2em] text-gold uppercase mb-6">
            Pre-Open Reservation
          </p>
          <h1 className="hero-fade-2 font-display text-4xl sm:text-7xl leading-[1.25] sm:leading-[1.15] tracking-tight mb-8">
            신나게 나아지는 몸,
            <br />
            신나아짐에서 시작합니다
          </h1>
          <p className="hero-fade-3 max-w-xl text-bone/80 leading-relaxed mb-3">
            물리치료사가 설계하는 프리미엄 PT, 신나아짐이 곧 문을 엽니다.
            오픈에 앞서 가장 먼저 예약하고 첫 회원이 되어주세요.
          </p>
          <p className="hero-fade-3 max-w-xl text-sm text-sage mb-12">
            트레이너 전원 물리치료사 면허 보유 · 재활 임상 경험 기반 운동 설계
          </p>
          <div className="hero-fade-4">
            <PulseLine className="w-full max-w-xl h-16 text-gold" />
            <a
              href="#reserve"
              className="group inline-flex items-center gap-2 mt-12 rounded-full bg-gold text-bone px-8 py-3.5 font-medium tracking-wide shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/30"
            >
              사전예약 하러 가기
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section id="trainer" className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <p className="text-sm tracking-[0.2em] text-gold uppercase mb-3">
              Our Trainer
            </p>
            <h2 className="font-display text-3xl mb-14">트레이너 소개</h2>
          </Reveal>
          <div className="grid gap-10 sm:grid-cols-[280px_1fr] items-start">
            <Reveal>
              <Image
                src="/trainer-shinjongsu.jpg"
                alt={`물리치료사 ${TRAINER_NAME}`}
                width={472}
                height={692}
                className="w-full max-w-[280px] mx-auto sm:max-w-none rounded-2xl shadow-lg"
              />
            </Reveal>
            <Reveal delayMs={100}>
              <p className="font-display text-2xl mb-1">{TRAINER_NAME}</p>
              <p className="text-xs tracking-[0.15em] text-gold uppercase mb-5">
                Physical Therapist
              </p>
              <p className="text-ink/70 leading-relaxed mb-8">{TRAINER_BIO}</p>

              <div className="grid gap-8 sm:grid-cols-2 mb-8">
                <div>
                  <p className="font-medium text-sm mb-2.5">자격</p>
                  <ul className="space-y-1.5 text-sm text-ink/70">
                    {TRAINER_QUALIFICATIONS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm mb-2.5">경력</p>
                  <ul className="space-y-1.5 text-sm text-ink/70">
                    {TRAINER_CAREER.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <p className="font-medium text-sm mb-2.5">이수 교육</p>
                <div className="flex flex-wrap gap-2">
                  {TRAINER_EDUCATION.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-bone px-3 py-1.5 text-xs text-ink/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20 border-t border-line">
          <Reveal>
            <p className="text-sm tracking-[0.2em] text-gold uppercase mb-3">
              How It Works
            </p>
            <h2 className="font-display text-3xl mb-14">처음 오시는 날의 순서</h2>
          </Reveal>
          <div className="relative">
            <div
              aria-hidden="true"
              className="hidden sm:block absolute left-0 right-0 top-[26px] border-t border-line"
            />
            <div className="grid gap-10 sm:grid-cols-4">
              {PROCESS_STEPS.map((step, i) => (
                <Reveal key={step.n} delayMs={i * 100}>
                  <div className="relative">
                    <span className="relative z-10 inline-block bg-paper pr-4 font-display text-5xl text-gold">
                      {step.n}
                    </span>
                    <h3 className="font-display text-lg mt-4 mb-2">{step.title}</h3>
                    <p className="text-sm text-ink/70 leading-relaxed">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="reserve" className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <PulseLine className="w-24 h-8 text-gold/70 mb-6" />
              <p className="text-sm tracking-[0.2em] text-gold uppercase mb-3">
                Reservation
              </p>
              <h2 className="font-display text-3xl mb-3">사전예약 안내</h2>
              <p className="text-ink/70 mb-12 leading-relaxed">
                아래 달력에서 원하시는 날짜와 시간을 선택해주세요. 예약은 오전 9시부터
                오후 10시까지 1시간 단위로 가능하며, 한 시간에 한 분만 예약하실 수
                있어요. 예약이 확정되면 남겨주신 연락처로 안내드릴게요.
              </p>
            </Reveal>
            <ReservationForm initialTaken={initialTaken} />
          </div>
        </section>

        <section id="location" className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <PulseLine className="w-24 h-8 text-gold/70 mb-6" />
              <p className="text-sm tracking-[0.2em] text-gold uppercase mb-3">
                Location
              </p>
              <h2 className="font-display text-3xl mb-3">오시는 길</h2>
              <p className="text-ink/70 mb-10 leading-relaxed">
                {STUDIO_ADDRESS}
                <br />
                문의 · <span className="text-gold font-medium">010-6859-6114</span>
              </p>
            </Reveal>
            <Reveal delayMs={100}>
              <div className="grid gap-6 sm:grid-cols-[1fr_1.3fr] items-stretch">
                <div className="rounded-2xl bg-bone/50 border border-line p-6 flex flex-col justify-between">
                  <div>
                    <p className="font-display text-lg mb-2">신나아짐 PT</p>
                    <p className="text-sm text-ink/70 leading-relaxed">{STUDIO_ADDRESS}</p>
                  </div>
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(STUDIO_ADDRESS)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-sm text-gold font-medium hover:underline"
                  >
                    네이버 지도에서 길찾기
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="rounded-2xl overflow-hidden border border-line h-64 sm:h-auto">
                  <iframe
                    title="신나아짐 위치 지도"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(STUDIO_ADDRESS)}&z=16&output=embed`}
                    className="w-full h-full grayscale-[15%]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-ink/60 flex flex-col gap-2">
          <p className="font-display text-base text-ink">신나아짐</p>
          <p>전 직원 물리치료사 면허 보유 · 프리미엄 PT 스튜디오</p>
          <p>{STUDIO_ADDRESS}</p>
          <p>
            문의 · <span className="text-gold font-medium">010-6859-6114</span>
          </p>
          <p>정확한 오픈일은 사전예약해주신 분들께 가장 먼저 안내드릴게요.</p>
        </div>
      </footer>
    </>
  );
}
