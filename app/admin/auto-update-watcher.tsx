"use client";

import { useEffect, useRef, useState } from "react";

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

    return () => {
      cancelled = true;
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
