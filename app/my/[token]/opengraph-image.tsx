import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMemberByToken } from "@/lib/schedule";

export const alt = "신나아짐 — 회원 예약 사이트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [logoData, fontData] = await Promise.all([
    readFile(join(process.cwd(), "public/logo.png")),
    readFile(
      join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"),
    ),
  ]);
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  // 회원 조회가 실패(DB 오류 등)해도 이미지 자체는 항상 생성되도록, 조회
  // 실패는 기본 문구로 조용히 대체한다(전체 실패 시 카톡 등에서 이 이미지
  // 대신 기본 아이콘으로 대체돼버리는 것을 막기 위함).
  let subtitle = "PRE-OPEN RESERVATION";
  try {
    const member = await getMemberByToken(token);
    if (member) subtitle = `${member.name}님의 예약 사이트`;
  } catch {
    // 기본 문구 유지
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#16241f",
          gap: 32,
        }}
      >
        <img src={logoSrc} width={320} height={136} style={{ objectFit: "contain" }} alt="" />
        <div style={{ display: "flex", color: "#f3ecdd", fontSize: 88, fontFamily: "Pretendard" }}>
          신나아짐
        </div>
        <div
          style={{
            display: "flex",
            color: "#9c7238",
            fontSize: 26,
            letterSpacing: 6,
            fontFamily: "Pretendard",
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pretendard", data: fontData, style: "normal", weight: 700 }],
    },
  );
}
