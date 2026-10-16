import { NextRequest, NextResponse } from "next/server";
import { getSessionDeviceId, setAdminSessionCookie } from "@/lib/auth";
import { BUILD_ID } from "@/lib/build-info";
import { isDeviceRevoked, touchDeviceHeartbeat } from "@/lib/devices";

// 설정 페이지의 "동기화 진단"이 주기적으로 호출한다. 이 기기가 원격 로그아웃
// 당했는지, 서버에 더 새로운 버전이 배포됐는지를 함께 확인해 클라이언트가
// 필요하면 로그아웃 처리하거나 새로고침하도록 한다.
export async function GET(req: NextRequest) {
  const deviceId = await getSessionDeviceId();
  if (!deviceId) {
    return NextResponse.json({ error: "세션이 없습니다." }, { status: 401 });
  }

  const clientVersion = req.nextUrl.searchParams.get("v") ?? "";
  await touchDeviceHeartbeat(deviceId, clientVersion);
  const revoked = await isDeviceRevoked(deviceId);

  // 관리자 페이지를 계속 켜둔 채(백그라운드 포함) 쓰는 동안은 세션이 만료 시각과
  // 무관하게 계속 연장되도록, 아직 로그아웃당하지 않은 요청마다 세션 쿠키를
  // 새 만료 시각으로 다시 발급한다. 이게 없으면 로그인 후 정확히 12시간이
  // 지나는 순간, PT 일지 등 긴 문서를 한창 작성 중이어도 갑자기 세션이 끊겨
  // 저장이 실패한다.
  if (!revoked) {
    await setAdminSessionCookie(deviceId);
  }

  return NextResponse.json({
    revoked,
    latestBuildId: BUILD_ID,
    checkedAt: new Date().toISOString(),
  });
}
