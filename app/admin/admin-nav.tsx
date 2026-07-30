"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/admin/dashboard", label: "대시보드" },
  { href: "/admin/schedule", label: "스케줄" },
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/retention", label: "재등록 관리" },
  { href: "/admin/reservations", label: "사전예약" },
  { href: "/admin/intake", label: "초진 문진표" },
  { href: "/admin/assessments", label: "평가지" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/expenses", label: "가계부" },
  { href: "/admin/settings", label: "설정" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [undoing, setUndoing] = useState(false);

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

        <nav className="order-3 w-full sm:order-none sm:w-auto flex items-center gap-1 rounded-full bg-bone/70 p-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                  active ? "bg-coral text-white shadow-sm" : "text-ink/60 hover:text-ink",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink/70 hover:bg-bone transition"
          >
            ⟳ 새로고침
          </button>

          <button
            onClick={handleUndo}
            disabled={undoing}
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink/70 hover:bg-bone transition disabled:opacity-50"
          >
            ← 뒤로가기
          </button>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink/70 hover:bg-bone transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
