import type { Metadata } from "next";
import { isAdminAuthed } from "@/lib/auth";
import { BUILD_ID } from "@/lib/build-info";
import { AdminNav } from "./admin-nav";
import { AutoUpdateWatcher } from "./auto-update-watcher";

// 루트 manifest(app/manifest.ts)는 start_url이 공개 사전예약 페이지("/")라서,
// 관리자가 /admin에서 "홈 화면에 추가"를 하면 아이콘을 눌러도 사전예약
// 페이지가 열리는 문제가 있었다. /admin 하위에서는 이 manifest로 덮어써
// start_url이 /admin이 되도록 한다.
export const metadata: Metadata = {
  manifest: "/admin-manifest.webmanifest",
};

// 로그인 전(회원 관리자 로그인 폼)에는 내비게이션을 보여주지 않고, 각 페이지의
// 자체 인증 검사(redirect)는 그대로 유지한다. 여기서는 오직 "인증된 페이지는
// 내비게이션이 새 페이지를 불러오는 동안에도 그대로 남아있게" 하기 위한
// 레이아웃 분리 목적만 담당한다.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return <>{children}</>;
  }
  return (
    <>
      <AutoUpdateWatcher buildId={BUILD_ID} />
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">{children}</main>
    </>
  );
}
