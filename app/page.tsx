import Image from "next/image";
import { IntroOverlay } from "@/app/components/IntroOverlay";
import { ReservationForm } from "@/app/components/ReservationForm";
import { Reveal } from "@/app/components/Reveal";

const TRAINER_NAME = "신종수";
const TRAINER_BIO_LINE_1 = "병원에서의 재활 경험과 헬스장 현장의 트레이닝 노하우를 가진 물리치료사 입니다.";
const TRAINER_BIO_LINE_2 =
  "제 목표는 단 하나, 회원님이 스스로 운동의 재미를 느끼고 평생의 습관을 만들도록 돕는 것입니다.";

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
  "러닝 피지오 교육 이수",
  "운동분석 기반 근골격계 관리 솔루션(KEMA) 교육 이수",
  "도수치료 및 카이로프랙틱(MTA) 교육 이수",
  "스포츠 재활 운동 교육(Sport Physio) 이수",
  "근골격계 및 스포츠 재활(Personal Physio) 교육 이수",
  "만성통증 중재 교육(Hello Pain) 이수",
  "근골격계 운동치료(EMP) 교육 이수",
];

const STUDIO_ADDRESS = "충청북도 청주시 흥덕구 서현로32 210,211호";
const FULL_STUDIO_ADDRESS = "충청북도 청주시 흥덕구 서현로32 가경자이프라자 2층 신나아짐";

// 히어로의 굵은 4줄 특징 — 1·2번만 강조색(골드)을 준다. 실제 내원 순서와
// 무관하게 병렬 나열이라 별도 정렬 로직 없이 순서 그대로 렌더링한다.
const HERO_FEATURES = [
  { text: "전 직원 물리치료사 출신", emphasis: true },
  { text: "자체 개발 앱으로 맞춤형 PT", emphasis: true },
  { text: "100% 프라이빗 회원 전용 공간", emphasis: false },
  { text: "아픈 몸 재활부터 완벽한 운동 자립까지!", emphasis: false },
];

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
    body: "자세, 가동범위, 근력, 기능을 물리치료사가 자체 개발 앱을 통해 직접 평가합니다.",
  },
  {
    n: "03",
    title: "운동 지도",
    body: "평가 결과를 바탕으로 지금 회원님 몸에 필요한 운동만 설계합니다.",
  },
  {
    n: "04",
    title: "기록",
    body: "매 세션의 PT일지를 기록하고, 운동 난이도를 점진적으로 조율해 나갑니다.",
  },
];

export default function Home() {
  return (
    <>
      {/* 세리프 제목 폰트(Gowun Batang)는 이 페이지에서만 쓰이므로 여기서만
          불러온다 — app/layout.tsx 참고. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
      />

      <IntroOverlay />

      <header className="relative overflow-hidden bg-[#1F2A24] px-6 pt-14 pb-22 text-[#EFE6D3]">
        <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="/images/center-interior.jpg"
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className="shinna-video-pan object-cover"
          />
          <div
            className="shinna-float-a absolute -right-[12%] -top-[10%] aspect-square w-[min(60vw,620px)] rounded-full blur-[4px]"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, rgba(217,192,143,0.33), rgba(217,192,143,0) 70%)",
            }}
          />
          <div className="absolute inset-0 bg-[#1F2A24]/45" />
          {/* 텍스트가 있는 왼쪽은 진하게, 오른쪽은 사진이 드러나도록 대각선으로
              한 번 더 어둡게 — 사진 배경 위에서도 글자 대비를 확보한다. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, #14201BF2 0%, #14201BD9 38%, #14201B59 68%, #14201B26 100%)",
            }}
          />
        </div>

        <div className="relative z-[1] mx-auto max-w-[780px]">
          <a href="#" className="hero-fade-1 mb-10 inline-flex items-center gap-2.5 sm:mb-14">
            <Image
              src="/logo-on-dark.png"
              alt="EXCITING"
              width={1585}
              height={488}
              priority
              className="h-[39px] w-auto opacity-90"
            />
            <span className="font-serif-display text-2xl font-bold sm:text-[30px]">신나아짐</span>
          </a>

          <p className="hero-fade-1 mb-5 text-sm tracking-[0.2em] text-[#FFB119] uppercase sm:text-base">
            IMPROVE YOUR BODY, EXCITING YOUR LIFE
          </p>
          <p className="hero-fade-2 text-xl leading-[1.75] sm:text-[30px]">
            물리치료사가 지도하는 프리미엄 PT
          </p>
          <h1 className="hero-fade-2 font-serif-display mt-3 mb-8 text-[32px] leading-[1.35] font-bold sm:text-[44px]">
            내 몸이 나아지고,
            <br />
            운동이 신나는 공간.
            <br />
            신나아짐에서 시작됩니다.
          </h1>

          <div className="hero-fade-3 mb-6">
            <span className="font-serif-display inline-block rounded-xl border border-[#D9C08F]/[0.33] bg-[#14201B] px-[22px] py-3 text-[22px] font-bold text-[#D9C08F] sm:text-[28px]">
              평생 20% 할인
            </span>
          </div>
          <div className="hero-fade-3 mb-8 space-y-1">
            <p className="text-xl text-[#D9C08F] sm:text-[29px]">
              오픈 후 한 달간 진행되는 이벤트예요
            </p>
            <p className="text-base text-[#EFE6D3] sm:text-lg">
              선착순 15% 할인 + 상담 후 바로 등록 시 추가 5%
            </p>
          </div>

          <ol className="hero-fade-3 mb-8 list-none space-y-1.5 leading-[1.9]">
            {HERO_FEATURES.map((item) => (
              <li
                key={item.text}
                className={[
                  "text-lg sm:text-[25px]",
                  item.emphasis ? "font-bold text-[#D9C08F]" : "text-white",
                ].join(" ")}
              >
                {item.text}
              </li>
            ))}
          </ol>

          <p className="hero-fade-3 mb-10 max-w-xl text-base leading-[1.75] text-[#EFE6D3]/[0.9]">
            개인마다 다른 체형과 불균형. 획일화된 머신이 아닌 맨몸과 프리웨이트로 진짜 내
            몸을 통제하는 능력을 키워드립니다.
          </p>

          <a
            href="#reserve"
            className="hero-fade-4 group inline-flex items-center gap-2 rounded-full bg-[#8A6D3B] px-6 py-3.5 text-lg font-semibold text-[#F6F1E7] shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:text-xl"
          >
            지금 사전예약하기
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
        </div>
      </header>

      <main className="flex-1 bg-[#F6F1E7] text-[#1F2A24]">
        <section id="trainer" className="mx-auto max-w-[980px] px-6 py-20">
          <Reveal>
            <h2 className="font-serif-display mb-14 text-[32px] sm:text-[45px]">대표 소개</h2>
          </Reveal>
          <div className="grid items-start gap-10 sm:grid-cols-[280px_1fr]">
            <Reveal>
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] sm:mx-0 sm:max-w-none">
                <Image
                  src="/trainer-shinjongsu.jpg"
                  alt={`신나아짐 대표 ${TRAINER_NAME}`}
                  fill
                  quality={100}
                  sizes="(min-width: 640px) 280px, 280px"
                  className="object-cover object-[center_18%] grayscale-[15%] sepia-[8%] contrast-[1.05]"
                />
              </div>
            </Reveal>
            <Reveal delayMs={100}>
              <p className="font-serif-display text-2xl">{TRAINER_NAME}</p>
              <p className="mb-5 text-xs tracking-[0.15em] text-[#8A6D3B] uppercase">
                Physical Therapist
              </p>
              <p className="mb-8 leading-[1.75] text-[#1F2A24]/70">
                {TRAINER_BIO_LINE_1}
                <br />
                {TRAINER_BIO_LINE_2}
              </p>

              <div className="mb-8 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-2.5 text-sm font-medium">자격</p>
                  <ul className="space-y-1.5 text-base leading-[1.8] text-[#1F2A24]/70">
                    {TRAINER_QUALIFICATIONS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2.5 text-sm font-medium">경력</p>
                  <ul className="space-y-1.5 text-base leading-[1.8] text-[#1F2A24]/70">
                    {TRAINER_CAREER.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-sm font-medium">이수 교육</p>
                <div className="flex flex-wrap gap-2">
                  {TRAINER_EDUCATION.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-[#EFE6D3] px-3 py-1.5 text-[15px] text-[#1F2A24]/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#1F2A24] px-6 py-22 text-[#EFE6D3]">
          <div className="mx-auto max-w-[980px]">
            <Reveal>
              <p className="mb-3 text-[13px] tracking-[0.2em] text-[#D9C08F] uppercase">
                How It Works
              </p>
              <h2 className="font-serif-display mb-14 text-[26px] sm:text-[30px]">
                처음 오시는 날의 순서
              </h2>
            </Reveal>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((step, i) => (
                <Reveal key={step.n} delayMs={i * 120}>
                  <div>
                    <span className="font-serif-display text-[34px] text-[#D9C08F] sm:text-[44px]">
                      {step.n}
                    </span>
                    <h3 className="font-serif-display mt-3.5 mb-2 text-xl sm:text-[25px]">
                      {step.title}
                    </h3>
                    <p className="text-base leading-[1.7] text-[#EFE6D3]/70">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="reserve">
          <div className="mx-auto max-w-[980px] px-6 py-20">
            <Reveal>
              <p className="mb-3 text-[13px] tracking-[0.2em] text-[#8A6D3B] uppercase">
                Reservation
              </p>
              <h2 className="font-serif-display mb-3 text-[26px] sm:text-[30px]">예약 안내</h2>
              <p className="mb-12 max-w-[640px] leading-[1.75] text-[#1F2A24]/70">
                아래 달력에서 원하시는 날짜와 시간을 선택해주세요.
                <br />
                예약은 오전 9시부터 오후 10시까지 1시간 단위로 가능하며,
                <br />
                한 시간에 한 분만 예약하실 수 있어요.
                <br />
                예약이 확정되면 남겨주신 연락처로 안내드릴게요.
              </p>
            </Reveal>
            <ReservationForm />
          </div>
        </section>

        <section id="location" className="border-t border-[#1F2A24]/[0.125]">
          <div className="mx-auto max-w-[980px] px-6 py-20">
            <Reveal>
              <p className="mb-3 text-lg tracking-[0.2em] text-[#8A6D3B] uppercase">Location</p>
              <h2 className="font-serif-display mb-3 text-[26px] sm:text-[30px]">오시는 길</h2>
              <p className="mb-10 text-lg leading-[1.75] text-[#1F2A24]/70">
                {FULL_STUDIO_ADDRESS}
                <br />
                문의 · <span className="font-medium text-[#8A6D3B]">010-2496-8088</span>
              </p>
            </Reveal>
            <Reveal delayMs={100}>
              <div className="grid items-stretch gap-6 sm:grid-cols-[1fr_1.3fr]">
                <div className="flex flex-col justify-between rounded-2xl border border-[#1F2A24]/[0.125] bg-[#EFE6D3]/50 p-6">
                  <div>
                    <p className="font-serif-display mb-2 text-lg">신나아짐 PT</p>
                    <p className="text-sm leading-relaxed text-[#1F2A24]/70">{STUDIO_ADDRESS}</p>
                  </div>
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(FULL_STUDIO_ADDRESS)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#8A6D3B] hover:underline"
                  >
                    네이버 지도에서 길찾기
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="h-64 overflow-hidden rounded-2xl border border-[#1F2A24]/[0.125] sm:h-auto">
                  <iframe
                    title="신나아짐 위치 지도"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(FULL_STUDIO_ADDRESS)}&z=16&output=embed`}
                    className="h-full w-full grayscale-[15%]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1F2A24]/[0.125] bg-[#F6F1E7]">
        <div className="mx-auto flex max-w-[980px] flex-col gap-2 px-6 py-12 text-sm text-[#1F2A24]/70">
          <p className="font-serif-display text-base text-[#1F2A24]">신나아짐</p>
          <p>전 직원 물리치료사 면허 보유 · 프리미엄 PT 스튜디오</p>
          <p>{FULL_STUDIO_ADDRESS}</p>
          <p>
            문의 · <span className="font-medium text-[#8A6D3B]">010-2496-8088</span>
          </p>
          <p>정확한 오픈일은 사전예약해주신 분들께 가장 먼저 안내드릴게요.</p>
        </div>
      </footer>
    </>
  );
}
