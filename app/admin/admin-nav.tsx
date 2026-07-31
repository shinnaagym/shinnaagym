"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const DEFAULT_TABS = [
  { href: "/admin/dashboard", label: "대시보드" },
  { href: "/admin/schedule", label: "스케줄" },
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/retention", label: "재등록 관리" },
  { href: "/admin/reservations", label: "사전예약" },
  { href: "/admin/intake", label: "초진 문진표" },
  { href: "/admin/assessments", label: "평가지" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/expenses", label: "가계부" },
  { href: "/admin/payroll", label: "급여 계산" },
  { href: "/admin/settings", label: "설정" },
];

type Tab = (typeof DEFAULT_TABS)[number];

const NAV_ORDER_STORAGE_KEY = "shinna_admin_nav_order";
const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 10;

/** 저장된 순서(href 배열)를 DEFAULT_TABS에 대입해 실제 탭 목록을 만든다.
    새로 추가된 탭(저장 당시 없던 href)은 뒤에 붙인다. */
function applyStoredOrder(storedHrefs: string[]): Tab[] {
  const byHref = new Map(DEFAULT_TABS.map((t) => [t.href, t]));
  const ordered = storedHrefs
    .map((href) => byHref.get(href))
    .filter((t): t is Tab => !!t);
  const missing = DEFAULT_TABS.filter((t) => !storedHrefs.includes(t.href));
  return [...ordered, ...missing];
}

function loadTabOrder(): Tab[] {
  try {
    const raw = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_TABS;
    const storedHrefs = JSON.parse(raw) as unknown;
    if (!Array.isArray(storedHrefs)) return DEFAULT_TABS;
    return applyStoredOrder(storedHrefs as string[]);
  } catch {
    return DEFAULT_TABS;
  }
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [undoing, setUndoing] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [draggingHref, setDraggingHref] = useState<string | null>(null);

  // 서버 렌더링과 항상 같은 기본 순서로 시작한 뒤, 마운트 후에만 저장된
  // 순서를 반영한다(SSR과 클라이언트 첫 렌더가 어긋나는 hydration 경고 방지).
  useEffect(() => {
    // localStorage는 서버에 없어 SSR 시점엔 기본 순서로 그리고, 마운트 후
    // 이 한 번만 클라이언트에 저장된 순서로 교체한다(구독할 외부 이벤트가
    // 없는 최초 1회성 하이드레이션이라 setState-in-effect 규칙을 비켜간다).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs(loadTabOrder());
  }, []);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const navScrollRef = useRef<HTMLElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollDirRef = useRef<0 | 1 | -1>(0);
  const autoScrollFrameRef = useRef<number | null>(null);
  const tabsRef = useRef(tabs);
  const draggingHrefRef = useRef<string | null>(null);

  // rAF 자동 스크롤 루프는 마운트 시점의 클로저를 그대로 재스케줄하며 도는
  // 재귀 호출이라, tabs/draggingHref state를 직접 참조하면 값이 고정돼버린다
  // (stale closure). 최신 값을 ref에 미러링해두고 루프에서는 ref로 읽는다.
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    draggingHrefRef.current = draggingHref;
  }, [draggingHref]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (autoScrollFrameRef.current !== null) cancelAnimationFrame(autoScrollFrameRef.current);
    };
  }, []);

  function persistOrder(next: Tab[]) {
    setTabs(next);
    try {
      localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(next.map((t) => t.href)));
    } catch {
      // 저장 실패(사생활 보호 모드 등)는 무시 — 이번 세션 동안만 순서가 유지된다.
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const EDGE_ZONE_PX = 44;
  const AUTO_SCROLL_SPEED = 12; // px per animation frame

  /** 드래그 중인 탭이 현재 (clientX, clientY) 아래의 탭과 겹치면 순서를 바꾼다.
      pointermove 이벤트뿐 아니라, 가장자리 자동 스크롤 중(손가락은 멈춰 있어도
      탭들이 밀려 지나가는 동안)에도 매 프레임 다시 계산해야 순서가 계속 맞는다. */
  function applySwapAt(clientX: number, clientY: number) {
    const dragHref = draggingHrefRef.current;
    if (!dragHref) return;
    const el = document.elementFromPoint(clientX, clientY);
    const overHref = el?.closest<HTMLElement>("[data-tab-href]")?.dataset.tabHref;
    if (!overHref || overHref === dragHref) return;
    const current = tabsRef.current;
    const fromIdx = current.findIndex((t) => t.href === dragHref);
    const toIdx = current.findIndex((t) => t.href === overHref);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...current];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setTabs(next);
  }

  function stopAutoScroll() {
    autoScrollDirRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function stepAutoScroll() {
    const container = navScrollRef.current;
    const dir = autoScrollDirRef.current;
    if (!container || dir === 0 || !draggingRef.current) {
      autoScrollFrameRef.current = null;
      return;
    }
    container.scrollLeft += dir * AUTO_SCROLL_SPEED;
    const p = lastPointerRef.current;
    if (p) applySwapAt(p.x, p.y);
    autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
  }

  /** 스크롤 가능한 탭 목록 안에서, 화면 밖으로 밀려난 탭에도 드래그로 이동할
      수 있도록 손가락/커서가 좌우 가장자리 근처에 있으면 자동으로 스크롤한다. */
  function updateAutoScroll(clientX: number) {
    const container = navScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let dir: 0 | 1 | -1 = 0;
    if (clientX < rect.left + EDGE_ZONE_PX) dir = -1;
    else if (clientX > rect.right - EDGE_ZONE_PX) dir = 1;
    autoScrollDirRef.current = dir;
    if (dir !== 0 && autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, href: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // 포인터 캡처를 명시적으로 잡아둔다 — 특히 마우스/트랙패드는 브라우저가
    // 자동으로 캡처해주지 않아, 캡처 없이는 커서가 이 탭의 영역을 벗어나는
    // 순간 이 요소에 등록된 move/up 핸들러가 더 이상 호출되지 않아 드래그가
    // 끊겨버린다(터치는 보통 암묵적 캡처가 있어 덜 두드러지지만 기기마다 다르다).
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      draggingRef.current = true;
      setDraggingHref(href);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      const start = pointerStartRef.current;
      if (start) {
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearLongPressTimer();
      }
      return;
    }
    e.preventDefault();
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    updateAutoScroll(e.clientX);
    applySwapAt(e.clientX, e.clientY);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    clearLongPressTimer();
    stopAutoScroll();
    if (draggingRef.current) {
      persistOrder(tabsRef.current);
      suppressClickRef.current = true;
      // 드래그 직후 발생하는 클릭(탭 이동) 한 번만 무시하고 바로 해제한다.
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    setDraggingHref(null);
    pointerStartRef.current = null;
  }

  function handleTabClick(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
    router.refresh();
  }

  // 직전에 실행한 저장/등록/삭제 동작을 실제로 되돌린다(단순 화면 이동이 아니라
  // 방금 만든 예약·회원·결제 내역 등을 취소해 이전 상태로 복원한다).
  async function handleUndo() {
    setUndoing(true);
    try {
      const res = await fetch("/api/admin/undo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "되돌릴 작업이 없어요.");
        return;
      }
      alert(`"${data.description}" 작업을 취소했어요.`);
      window.location.reload();
    } finally {
      setUndoing(false);
    }
  }

  return (
    <header className="no-print sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:h-16 flex flex-wrap items-center justify-between gap-y-3 gap-x-4 sm:flex-nowrap">
        <Link href="/admin/dashboard" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="신나아짐" width={271} height={341} className="h-7 w-auto" />
          <span className="font-display text-base text-ink hidden sm:inline">신나아짐</span>
          <span className="text-xs text-ink/40 hidden sm:inline">관리자</span>
        </Link>

        <nav
          ref={navScrollRef}
          className="order-3 w-full sm:order-none sm:w-auto flex items-center gap-1 rounded-full bg-bone/70 p-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            const isDragging = draggingHref === tab.href;
            return (
              <div
                key={tab.href}
                data-tab-href={tab.href}
                onPointerDown={(e) => handlePointerDown(e, tab.href)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  touchAction: "none",
                  WebkitTouchCallout: "none",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                }}
                className={[
                  "shrink-0 rounded-full transition-transform",
                  isDragging ? "scale-105 shadow-md z-10" : "",
                ].join(" ")}
              >
                <Link
                  href={tab.href}
                  onClick={handleTabClick}
                  onContextMenu={(e) => e.preventDefault()}
                  draggable={false}
                  style={{ WebkitTouchCallout: "none" }}
                  className={[
                    "block px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors select-none",
                    active ? "bg-coral text-white shadow-sm" : "text-ink/60 hover:text-ink",
                    isDragging ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={undoing}
            title="뒤로가기"
            className="shrink-0 rounded-full border border-line px-2 py-1 text-xs text-ink/70 hover:bg-bone transition disabled:opacity-50"
          >
            ←
          </button>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-ink/70 hover:bg-bone transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
