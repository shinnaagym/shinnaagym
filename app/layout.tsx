import type { Metadata } from "next";
import { Gowun_Batang } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 홈페이지 제목/이정표용 세리프 — 본문(Pretendard)과 뚜렷이 구분되는
// 서체 페어링으로, 물리치료 전문 클리닉다운 차분하고 신뢰감 있는 인상을 준다.
const gowunBatang = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-gowun-batang",
  display: "swap",
});

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
    <html
      lang="ko"
      className={`${pretendard.variable} ${gowunBatang.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
