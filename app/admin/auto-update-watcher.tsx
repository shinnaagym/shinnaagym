"use client";

import { useEffect, useRef, useState } from "react";

// Vercel의 서버리스 함수는 한동안 요청이 없으면 인스턴스가 완전히 꺼진다(콜드
// 스타트) — DB 커넥션 풀도 매번 새로 맺어야 해서, 오랜만에 들어온 요청 하나가
// 몇 초씩 걸리는 원인이 된다. 설정 페이지(sync-diagnostics)에는 이미 30초
// 주기로 heartbeat를 찍는 로직이 있지만 그 페이지에 있을 때만 동작한다 —
// 관리자 페이지 전체에 항상 떠 있는 이 컴포넌트에도 같은 주기 핑을 붙여서,
// 관리자 탭을 켜둔 채(백그라운드 포함) 다른 일을 하는 동안에도 인스턴스가
// 최대한 안 꺼지게 한다. 다만 브라우저가 백그라운드 탭의 타이머를 강하게
// 쓰로틀링하므로(특히 오래 안 보고 있으면 1분 이상으로 늘어남) 완전한
// 해결책은 아니고, 짧은 자리비움에 대한 완화책이다.
const KEEP_WARM_INTERVAL_MS = 4 * 60 * 1000;

/** 홈 화면에 추가한 관리자 PWA는 아이콘을 다시 눌러도 iOS가 새로고침 없이
    이전 화면을 그대로 보여주는 경우가 많다. 화면이 다시 보일 때마다 서버의
    최신 배포 버전과 비교해, 오래된 버전이면 자동으로 새로고침한다. */
export function AutoUpdateWatcher({ buildId }: { buildId: string }) {
  const [updating, setUpdating] = useState(false);
  const triggeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      if (triggeredRef.current) return;
      try {
        const res = await fetch(`/api/admin/heartbeat?v=${encodeURIComponent(buildId)}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || triggeredRef.current) return;
        if (data.latestBuildId && data.latestBuildId !== buildId) {
          triggeredRef.current = true;
          setUpdating(true);
          setTimeout(() => window.location.reload(), 1200);
        }
      } catch {
        // 네트워크 오류는 무시하고 다음 포그라운드 전환 때 다시 확인한다.
      }
    }

    checkVersion();

    function handleVisibility() {
      if (document.visibilityState === "visible") checkVersion();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", checkVersion);
    window.addEventListener("focus", checkVersion);

    // 탭을 보고 있지 않아도(다른 사이트 작업 중 등) 계속 핑을 보내 인스턴스가
    // 꺼지는 걸 늦춘다 — checkVersion 자체가 이미 실패를 조용히 무시하므로
    // 탭이 완전히 닫혀 fetch가 실패해도 안전하다.
    const keepWarmTimer = setInterval(checkVersion, KEEP_WARM_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(keepWarmTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", checkVersion);
      window.removeEventListener("focus", checkVersion);
    };
  }, [buildId]);

  if (!updating) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-coral text-white text-center text-xs py-1.5">
      새 버전으로 업데이트 중...
    </div>
  );
}
