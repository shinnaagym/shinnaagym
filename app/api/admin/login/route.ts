import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, getOrCreateDeviceId, setAdminSessionCookie } from "@/lib/auth";
import { BUILD_ID } from "@/lib/build-info";
import { labelFromUserAgent, upsertDeviceOnLogin } from "@/lib/devices";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const password = (body as Record<string, unknown> | null)?.password;
  if (typeof password !== "string" || !checkAdminPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const deviceId = await getOrCreateDeviceId();
  const deviceLabel = labelFromUserAgent(req.headers.get("user-agent") ?? "");
  await upsertDeviceOnLogin(deviceId, deviceLabel, BUILD_ID);
  await setAdminSessionCookie(deviceId);
  return NextResponse.json({ ok: true });
}
