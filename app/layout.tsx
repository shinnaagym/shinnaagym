import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 홈페이지 제목/이정표용 세리프(Gowun Batang)는 next/font/google 대신 일반
// <link> 태그로 불러온다. next/font/google은 빌드 시점에 Google 서버에서
// 폰트 파일을 직접 내려받는데, Vercel 빌드 환경에서 그 요청이 실패하면
// 빌드 자체가 통째로 실패한다(실제로 이 문제로 배포가 깨진 적이 있음).
// 브라우저가 런타임에 직접 불러오는 방식으로 바꿔 빌드 시 네트워크 의존을 없앤다.

const SITE_TITLE = "신나아짐 예약 사이트";
const SITE_DESCRIPTION =
  "전 직원이 물리치료사인 프리미엄 PT 스튜디오, 신나아짐의 오픈 전 사전예약 페이지입니다.";

export const metadata: Metadata = {
  metadataBase: new URL("https://shinnaagym.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
