import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "신나아짐 — 전 직원 물리치료사인 프리미엄 PT 스튜디오";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [logoData, fontData] = await Promise.all([
    readFile(join(process.cwd(), "public/logo-on-dark.png")),
    readFile(
      join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"),
    ),
  ]);
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

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
        <img src={logoSrc} width={320} height={161} style={{ objectFit: "contain" }} alt="" />
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
          PRE-OPEN RESERVATION
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pretendard", data: fontData, style: "normal", weight: 700 }],
    },
  );
}
