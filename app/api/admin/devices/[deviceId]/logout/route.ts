import { NextResponse } from "next/server";
import { clearAdminSessionCookie, getDeviceId, isAdminAuthed } from "@/lib/auth";
import { revokeDevice } from "@/lib/devices";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { deviceId } = await params;
  await revokeDevice(deviceId);

  const currentDeviceId = await getDeviceId();
  if (currentDeviceId === deviceId) {
    await clearAdminSessionCookie();
  }

  return NextResponse.json({ ok: true });
}
