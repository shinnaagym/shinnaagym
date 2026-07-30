import { NextRequest, NextResponse } from "next/server";
import { getSessionDeviceId } from "@/lib/auth";
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

  return NextResponse.json({
    revoked,
    latestBuildId: BUILD_ID,
    checkedAt: new Date().toISOString(),
  });
}
