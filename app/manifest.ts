import type { MetadataRoute } from "next";

// 이 파일이 있으면 Next.js가 /manifest.webmanifest를 만들고 <link rel="manifest">
// 태그도 자동으로 넣어준다. 홈 화면에 추가했을 때 브라우저 주소창 없이 앱처럼
// 열리게(display: "standalone") 하는 데 필요하다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "신나아짐 PT 스튜디오",
    short_name: "신나아짐",
    description: "전 직원이 물리치료사인 프리미엄 PT 스튜디오, 신나아짐",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
