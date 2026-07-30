import { NextResponse } from "next/server";
import { getDeviceId, isAdminAuthed } from "@/lib/auth";
import { listActiveDevices } from "@/lib/devices";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const [devices, currentDeviceId] = await Promise.all([listActiveDevices(), getDeviceId()]);
  return NextResponse.json({ devices, currentDeviceId });
}
