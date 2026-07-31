"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminDeviceRow } from "@/lib/db";

const HEARTBEAT_INTERVAL_MS = 30_000;

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function SyncDiagnostics({
  buildId,
  initialDevices,
  currentDeviceId,
}: {
  buildId: string;
  initialDevices: AdminDeviceRow[];
  currentDeviceId: string | null;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [latestBuildId, setLatestBuildId] = useState(buildId);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDevices = useCallback(async () => {
    const res = await fetch("/api/admin/devices");
    if (!res.ok) return;
    const data = await res.json();
    setDevices(data.devices ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkHeartbeat() {
      try {
        const res = await fetch(`/api/admin/heartbeat?v=${encodeURIComponent(buildId)}`);
        if (res.status === 401) {
          // 이 기기가 원격으로 로그아웃되어 세션 자체가 사라진 경우.
          window.location.href = "/admin";
          return;
        }
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.revoked) {
          await fetch("/api/admin/logout", { method: "POST" });
          window.location.href = "/admin";
          return;
        }

        setLastCheckedAt(data.checkedAt);
        setLatestBuildId(data.latestBuildId);

        if (data.latestBuildId !== buildId && !reloadTimerRef.current) {
          setUpdating(true);
          reloadTimerRef.current = setTimeout(() => {
            window.location.reload();
          }, 1800);
        }
      } catch {
        // 네트워크 일시 오류는 무시하고 다음 주기에 재시도한다.
      }
    }

    checkHeartbeat();
    const timer = setInterval(checkHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [buildId]);

  async function handleLogoutDevice(deviceId: string) {
    const isSelf = deviceId === currentDeviceId;
    if (!confirm(isSelf ? "이 기기를 로그아웃할까요?" : "이 기기를 원격으로 로그아웃할까요?")) {
      return;
    }
    setLoggingOutId(deviceId);
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/logout`, { method: "POST" });
      if (!res.ok) return;
      if (isSelf) {
        window.location.href = "/admin";
        return;
      }
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } finally {
      setLoggingOutId(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
      <h2 className="font-display text-lg mb-1">동기화 진단</h2>
      <p className="text-xs text-ink/50 mb-4">
        {updating
          ? "새 버전이 발견되어 잠시 후 화면을 새로고침합니다..."
          : "다른 기기에서도 로그인되어 있는지, 최신 버전을 쓰고 있는지 여기서 확인할 수 있어요."}
      </p>
      <div className="divide-y divide-line/50 text-sm">
        <div className="flex items-center justify-between py-2.5">
          <span className="text-ink/50">이 기기 앱 버전</span>
          <span className="font-mono">{shortId(buildId)}</span>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-ink/50">서버에 기록된 최신 버전</span>
          <span className="font-mono flex items-center gap-1.5">
            {shortId(latestBuildId)}
            {latestBuildId === buildId ? (
              <span className="text-sage text-xs">✓ 최신</span>
            ) : (
              <span className="text-coral text-xs">업데이트 필요</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-ink/50">마지막 서버 확인</span>
          <span className="text-ink/70">{lastCheckedAt ? formatDateTime(lastCheckedAt) : "확인 중..."}</span>
        </div>
      </div>

      <h3 className="font-display text-base mt-6 mb-1">최근 접속 기기</h3>
      <p className="text-xs text-ink/50 mb-3">구버전 기기가 있다면 로그아웃 후 다시 로그인해 최신 버전으로 갱신해주세요.</p>
      <div className="divide-y divide-line/50">
        {devices.map((d) => {
          const isThisDevice = d.device_id === currentDeviceId;
          const isOutdated = d.app_version !== latestBuildId;
          return (
            <div key={d.device_id} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm">{d.device_label}</span>
                <span className="text-xs text-ink/40 font-mono">{shortId(d.device_id)}</span>
                {isThisDevice && (
                  <span className="rounded-full bg-bone px-2 py-0.5 text-[11px] text-ink/60">
                    이 기기
                  </span>
                )}
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px]",
                    isOutdated ? "bg-coral/10 text-coral" : "bg-sage/10 text-sage",
                  ].join(" ")}
                >
                  {isOutdated ? "구버전" : "최신"}
                </span>
                <span className="text-xs text-ink/40">{formatDateTime(d.last_seen_at)}</span>
              </div>
              <button
                onClick={() => handleLogoutDevice(d.device_id)}
                disabled={loggingOutId === d.device_id}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-bone transition disabled:opacity-50"
              >
                로그아웃
              </button>
            </div>
          );
        })}
        {devices.length === 0 && (
          <p className="text-sm text-ink/40 py-2.5">접속 기록이 없어요.</p>
        )}
      </div>
      <button
        onClick={refreshDevices}
        className="mt-3 text-xs text-ink/50 hover:text-coral transition"
      >
        ⟳ 기기 목록 새로고침
      </button>
    </section>
  );
}
