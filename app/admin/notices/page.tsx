import { redirect } from "next/navigation";

// 공지사항 관리는 설정 페이지(공휴일 관리 아래)로 옮겨졌다 — 이 경로로 오는
// 북마크·링크가 있을 수 있어 그대로 리다이렉트만 해준다.
export default function NoticesPage() {
  redirect("/admin/settings");
}
