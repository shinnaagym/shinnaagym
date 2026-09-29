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
  // 자동재생이 막힌 브라우저(iOS Safari, 카카오톡 인앱브라우저 등)를 위해 등록해둔
  // 재시도 리스너들 — 인트로가 끝나면(finish) 한 번에 정리한다.
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;

    const tryPlay = () => {
      video.play().catch(() => {
        // 이번 시도도 막히면 아래 등록해둔 다른 재시도 시점(로드 완료·터치·탭 복귀)에서
        // 다시 시도한다. 그래도 안 되면 4.6초 타이머로 어차피 넘어간다.
      });
    };

    const removers: Array<() => void> = [];
    const on = (target: EventTarget, type: string, handler: EventListener) => {
      target.addEventListener(type, handler);
      removers.push(() => target.removeEventListener(type, handler));
    };

    video.load();
    tryPlay();
    // 로드가 늦게 끝나는 환경(느린 네트워크)에서도 재생을 다시 시도.
    on(video, "loadeddata", tryPlay);
    on(video, "canplay", tryPlay);
    // 자동재생 정책 때문에 막힌 경우, 사용자의 첫 터치/클릭이나 탭이 다시
    // 보이는 시점(백그라운드 탭에서 돌아옴)에 재생을 재시도한다.
    on(window, "touchstart", tryPlay);
    on(window, "pointerdown", tryPlay);
    on(document, "visibilitychange", tryPlay);

    // 안전장치: 자동재생도 막히고(일부 인앱 브라우저) 탭도 인식되지 않는
    // 환경에서 사용자가 인트로에 갇히지 않도록, 4.6초가 지나면 무조건
    // 다음 화면으로 넘긴다.
    const timeoutId = window.setTimeout(() => {
      cleanupRef.current();
      setDone(true);
    }, 4600);
    removers.push(() => window.clearTimeout(timeoutId));

    cleanupRef.current = () => removers.forEach((remove) => remove());
    return () => cleanupRef.current();
  }, []);

  function finish() {
    cleanupRef.current();
    setDone(true);
  }

  return (
    <div
      onClick={finish}
      aria-hidden={done}
      className={[
        "fixed inset-0 z-[9999] cursor-pointer overflow-hidden bg-[#1C1E22] transition-[opacity,visibility] duration-700 ease-out",
        done ? "invisible pointer-events-none opacity-0" : "visible opacity-100",
      ].join(" ")}
    >
      <video
        ref={videoRef}
        // 일부 인앱 브라우저(카카오톡 등)는 재생 전 영상을 탭하면 우리 쪽
        // onClick 대신 자체 재생 버튼 UI로 탭을 가로채, 화면을 눌러도 인트로가
        // 안 넘어가는 문제가 있었다. pointer-events-none으로 영상은 탭을 아예
        // 받지 않게 하고, 모든 탭이 부모 div의 onClick(finish)으로만 가게 한다.
        className="pointer-events-none absolute inset-0 h-full w-full bg-[#1C1E22] object-contain"
        src="/videos/intro-logo.mp4"
        autoPlay
        muted
        playsInline
        {...{ "webkit-playsinline": "true", "x5-playsinline": "true" }}
        disablePictureInPicture
        preload="auto"
        onEnded={finish}
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
