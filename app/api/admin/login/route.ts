import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, getOrCreateDeviceId, setAdminSessionCookie } from "@/lib/auth";
import { BUILD_ID } from "@/lib/build-info";
import { labelFromUserAgent, upsertDeviceOnLogin } from "@/lib/devices";
import { checkLoginLock, clearLoginAttempts, getClientIp, recordFailedLogin } from "@/lib/login-rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const lock = await checkLoginLock(ip, "admin");
  if (lock.locked) {
    const minutes = Math.ceil((lock.retryAfterSeconds ?? 0) / 60);
    return NextResponse.json(
      { error: `로그인 실패가 너무 많아 잠시 잠겼습니다. ${minutes}분 후 다시 시도해주세요.` },
      { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds ?? 0) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const password = (body as Record<string, unknown> | null)?.password;
  if (typeof password !== "string" || !checkAdminPassword(password)) {
    await recordFailedLogin(ip, "admin");
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await clearLoginAttempts(ip, "admin");
  const deviceId = await getOrCreateDeviceId();
  const deviceLabel = labelFromUserAgent(req.headers.get("user-agent") ?? "");
  await upsertDeviceOnLogin(deviceId, deviceLabel, BUILD_ID);
  await setAdminSessionCookie(deviceId);
  return NextResponse.json({ ok: true });
}
