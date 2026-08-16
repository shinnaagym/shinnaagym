import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image의 quality prop은 여기 허용 목록에 없는 값을 넘기면 조용히
  // 기본값(75)으로 깎인다 — 대표 사진처럼 원본 자체가 작아서 추가 압축을
  // 최대한 피해야 하는 이미지에 90/100을 쓰려면 여기 미리 등록해둬야 한다.
  images: {
    qualities: [75, 90, 100],
  },
  // public/ 정적 파일(manifest, 아이콘)은 기본적으로 max-age=0이라 페이지를
  // 옮겨다닐 때마다(대시보드→재등록→문진표 등) 매번 서버에 재검증 요청을
  // 보낸다. 자주 안 바뀌는 파일들이라 하루 정도는 재검증 없이 그대로 써도
  // 되므로, 세션 내 중복 요청을 없애도록 캐시 기간을 넉넉히 준다.
  async headers() {
    const cacheControl = { key: "Cache-Control", value: "public, max-age=86400" };
    return [
      "/admin-manifest.webmanifest",
      "/icon-192.png",
      "/icon-512.png",
      "/apple-icon.png",
      "/favicon.ico",
    ].map((source) => ({ source, headers: [cacheControl] }));
  },
};

export default nextConfig;
