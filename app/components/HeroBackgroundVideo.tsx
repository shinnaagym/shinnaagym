"use client";

import { useEffect, useRef } from "react";

// 히어로 배경 영상 — 앞 3초 구간만 0.5배속 슬로우모션으로 무한 반복한다.
// (풀 영상을 다 틀면 느낌이 늘어져서, 가장 좋은 앞부분만 계속 반복하도록
// timeupdate에서 3초에 도달하면 처음으로 되돌린다. loop 속성은 만약을
// 대비한 안전장치.)
export function HeroBackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playbackRate = 0.5;
    video.play().catch(() => {});

    function handleTimeUpdate() {
      if (video && video.currentTime >= 3) {
        video.currentTime = 0;
      }
    }
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  return (
    <video
      ref={videoRef}
      className="shinna-video-pan absolute inset-0 h-full w-full object-cover"
      src="/videos/center-interior.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  );
}
