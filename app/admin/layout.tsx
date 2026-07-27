import { isAdminAuthed } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

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
      <AdminNav />
      <main className="flex-1 bg-[#f7f8fa]">{children}</main>
    </>
  );
}
