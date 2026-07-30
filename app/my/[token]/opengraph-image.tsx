import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMemberByToken } from "@/lib/schedule";

export const alt = "신나아짐 — 회원 예약 사이트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [logoData, fontData, member] = await Promise.all([
    readFile(join(process.cwd(), "public/logo.png")),
    readFile(
      join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"),
    ),
    getMemberByToken(token),
  ]);
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  const subtitle = member ? `${member.name}님의 예약 사이트` : "PRE-OPEN RESERVATION";

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
        <img src={logoSrc} width={168} height={211} style={{ objectFit: "contain" }} alt="" />
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
