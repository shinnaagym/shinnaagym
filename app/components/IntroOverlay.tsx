"use client";

import { useEffect, useRef, useState } from "react";

// 첫 방문 시 브랜드 로고 영상으로 전체 화면을 잠깐 덮는 인트로. 영상이 끝나거나
// (ended 이벤트) 4.6초가 지나거나, 아무 곳이나 클릭하면 즉시 사라진다.
// prefers-reduced-motion이면 아예 띄우지 않는다.
export function IntroOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [done, setDone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.play().catch(() => {
        // 자동재생이 막혀도 4.6초 뒤 타이머로 어차피 넘어간다.
      });
    }
    const timer = window.setTimeout(() => setDone(true), 4600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      onClick={() => setDone(true)}
      aria-hidden={done}
      className={[
        "fixed inset-0 z-[9999] cursor-pointer overflow-hidden bg-[#1C1E22] transition-[opacity,visibility] duration-700 ease-out",
        done ? "invisible pointer-events-none opacity-0" : "visible opacity-100",
      ].join(" ")}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/intro-logo.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setDone(true)}
      />
      <p
        className="shinna-intro-word absolute left-1/2 top-[68%] -translate-x-1/2 whitespace-nowrap text-center text-white"
        style={{
          fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
          fontWeight: 900,
          fontSize: "clamp(52px, 11vw, 132px)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        신나아짐
      </p>
      <p className="shinna-intro-hint absolute bottom-10 left-1/2 -translate-x-1/2 text-[13px] tracking-[0.1em] text-[#EFE6D3]/[0.6]">
        눌러서 바로 보기 ↓
      </p>
    </div>
  );
}
