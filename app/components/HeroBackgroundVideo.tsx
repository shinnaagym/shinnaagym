"use client";

import { useEffect, useRef } from "react";

// 히어로 배경 영상 — 원본 영상 파일 자체가 이미 반복에 알맞은 길이(3.2초)로
// 잘려있어서, 0.5배속 슬로우모션으로 그 구간을 그대로 반복한다. 예전에는
// currentTime을 JS로 0초로 되돌려 구간 반복을 흉내냈는데, 그 수동 탐색(seek)이
// 매번 눈에 띄는 끊김(버퍼링처럼 보이는 현상)을 만들어서, 브라우저가 알아서
// 매끄럽게 처리하는 loop 속성만 쓰도록 단순화했다.
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
