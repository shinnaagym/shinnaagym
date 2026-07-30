import Image from "next/image";
import { PulseLine } from "@/app/components/PulseLine";
import { ReservationForm } from "@/app/components/ReservationForm";
import { Reveal } from "@/app/components/Reveal";

const TRAINER_NAME = "신종수";
const TRAINER_BIO =
  "보건복지부 면허를 보유한 운동 전문 물리치료사이자 생활체육지도자(보디빌딩 2급)로서, " +
  "병원에서의 재활 경험과 헬스장 현장에서의 실전 트레이닝 노하우를 결합했습니다. " +
  "회원님이 궁극적으로 저 없이도 스스로 안전하고 운동에 재미를 붙여드려 평생의 습관을 " +
  "만들어 드리는 것이 저의 확고한 목표입니다.";

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
  "근골격계 운동치료(EMP) 교육 이수",
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
    title: "운동 지도",
    body: "검사 결과를 바탕으로 지금 이 몸에 필요한 운동만 설계합니다.",
  },
  {
    n: "04",
    title: "기록",
    body: "매 세션의 변화를 기록하고, 운동 지도를 계속 조율해 나갑니다.",
  },
];

export default function Home() {
  return (
    <>
      <header className="relative overflow-hidden bg-ink text-bone">
        <div
          aria-hidden="true"
          className="energy-glow pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-gold/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-8 sm:pt-10">
          <a href="#" className="hero-fade-1 inline-flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="신나아짐 로고"
              width={271}
              height={341}
              priority
              className="h-12 w-auto sm:h-16"
            />
            <span className="font-serif-display text-2xl sm:text-3xl tracking-wide text-bone">
              신나아짐
            </span>
          </a>
        </div>
        <div className="relative mx-auto max-w-5xl px-6 pt-12 pb-16 sm:pt-16 sm:pb-24">
          <p className="hero-fade-1 text-sm tracking-[0.2em] text-gold-light uppercase mb-6">
            Pre-Open Reservation
          </p>
          <h1 className="hero-fade-2 font-serif-display text-[1.9rem] sm:text-7xl leading-[1.3] sm:leading-[1.15] tracking-tight mb-8">
            내 몸이 나아지고,
            <br />
            운동이 신나는 공간.
            <br />
            신나아짐에서 시작됩니다.
          </h1>
          <div className="hero-fade-2 flex flex-wrap items-center gap-3 mb-4">
            <span className="rounded-full border border-gold/50 px-3 py-1 text-xs tracking-[0.15em] text-gold-light uppercase">
              오픈 기념 특별
            </span>
            <span className="rounded-full bg-black border border-gold/40 px-4 py-1.5 text-sm font-semibold text-gold-light">
              평생 20% 할인
            </span>
          </div>
          <p className="hero-fade-2 text-sm text-sage mb-6">
            선착순 15% 할인 + 그 이후 등록 시 추가 5%
          </p>
          <p className="hero-fade-3 max-w-xl text-bone/80 leading-relaxed mb-3">
            물리치료사가 설계하는 프리미엄 PT, 신나아짐이 곧 문을 엽니다.
            오픈에 앞서 가장 먼저 예약하고 첫 회원이 되어주세요.
          </p>
          <div className="hero-fade-3 max-w-xl text-sm text-sage leading-relaxed mb-12 space-y-1.5">
            <p>1. 전 직원 물리치료사 출신</p>
            <p>2. 100% 프라이빗 회원 전용 공간</p>
            <p>3. 1:1 맞춤 기능성 트레이닝</p>
            <p>4. 아픈 몸 재활부터 완벽한 운동 자립까지!</p>
            <p className="pt-1.5">
              개인마다 다른 체형과 불균형. 획일화된 머신이 아닌 맨몸과 프리웨이트로
              진짜 내 몸을 통제하는 능력을 키워드립니다.
            </p>
          </div>
          <div className="hero-fade-4">
            <PulseLine className="w-full max-w-xl h-16 text-gold" />
            <a
              href="#reserve"
              className="group inline-flex items-center gap-2 mt-12 rounded-full bg-gold-deep text-bone px-8 py-3.5 font-medium tracking-wide shadow-lg shadow-gold-deep/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold-deep/30"
            >
              지금 사전예약하기
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
            <h2 className="font-serif-display text-3xl mb-14">대표 소개</h2>
          </Reveal>
          <div className="grid gap-10 sm:grid-cols-[280px_1fr] items-start">
            <Reveal>
              <div className="relative w-full max-w-[280px] mx-auto sm:max-w-none aspect-[4/5] rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="/trainer-shinjongsu.jpg"
                  alt={`신나아짐 대표 ${TRAINER_NAME}`}
                  fill
                  sizes="(min-width: 640px) 280px, 280px"
                  className="object-cover object-[center_18%] grayscale-[15%] sepia-[8%] contrast-[1.05]"
                />
              </div>
            </Reveal>
            <Reveal delayMs={100}>
              <p className="font-serif-display text-2xl mb-1">{TRAINER_NAME}</p>
              <p className="text-xs tracking-[0.15em] text-gold-deep uppercase mb-5">
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

        <section className="bg-ink text-bone py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal>
              <p className="text-sm tracking-[0.2em] text-gold-light uppercase mb-3">
                How It Works
              </p>
              <h2 className="font-serif-display text-3xl mb-14">처음 오시는 날의 순서</h2>
            </Reveal>
            <div className="relative">
              <div
                aria-hidden="true"
                className="hidden sm:block absolute left-0 right-0 top-1 h-10 text-gold/40"
              >
                <PulseLine className="w-full h-full" />
              </div>
              <div className="grid gap-10 sm:grid-cols-4">
                {PROCESS_STEPS.map((step, i) => (
                  <Reveal key={step.n} delayMs={i * 100}>
                    <div className="relative">
                      <span className="relative z-10 inline-block bg-ink pr-4 font-serif-display text-5xl text-gold">
                        {step.n}
                      </span>
                      <h3 className="font-serif-display text-lg mt-4 mb-2">{step.title}</h3>
                      <p className="text-sm text-bone/70 leading-relaxed">{step.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="reserve">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <PulseLine className="w-24 h-8 text-gold/70 mb-6" />
              <p className="text-sm tracking-[0.2em] text-gold-deep uppercase mb-3">
                Reservation
              </p>
              <h2 className="font-serif-display text-3xl mb-3">사전예약 안내</h2>
              <p className="text-ink/70 mb-12 leading-relaxed">
                아래 달력에서 원하시는 날짜와 시간을 선택해주세요. 예약은 오전 9시부터
                오후 10시까지 1시간 단위로 가능하며, 한 시간에 한 분만 예약하실 수
                있어요. 예약이 확정되면 남겨주신 연락처로 안내드릴게요.
              </p>
            </Reveal>
            <ReservationForm />
          </div>
        </section>

        <section id="location" className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <PulseLine className="w-24 h-8 text-gold/70 mb-6" />
              <p className="text-sm tracking-[0.2em] text-gold-deep uppercase mb-3">
                Location
              </p>
              <h2 className="font-serif-display text-3xl mb-3">오시는 길</h2>
              <p className="text-ink/70 mb-10 leading-relaxed">
                {STUDIO_ADDRESS}
                <br />
                문의 · <span className="text-gold-deep font-medium">010-6859-6114</span>
              </p>
            </Reveal>
            <Reveal delayMs={100}>
              <div className="grid gap-6 sm:grid-cols-[1fr_1.3fr] items-stretch">
                <div className="rounded-2xl bg-bone/50 border border-line p-6 flex flex-col justify-between">
                  <div>
                    <p className="font-serif-display text-lg mb-2">신나아짐 PT</p>
                    <p className="text-sm text-ink/70 leading-relaxed">{STUDIO_ADDRESS}</p>
                  </div>
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(STUDIO_ADDRESS)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-sm text-gold-deep font-medium hover:underline"
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
          <p className="font-serif-display text-base text-ink">신나아짐</p>
          <p>전 직원 물리치료사 면허 보유 · 프리미엄 PT 스튜디오</p>
          <p>{STUDIO_ADDRESS}</p>
          <p>
            문의 · <span className="text-gold-deep font-medium">010-6859-6114</span>
          </p>
          <p>정확한 오픈일은 사전예약해주신 분들께 가장 먼저 안내드릴게요.</p>
        </div>
      </footer>
    </>
  );
}
