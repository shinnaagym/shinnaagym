import { NextRequest, NextResponse } from "next/server";
import {
  checkPayrollPassword,
  clearPayrollSessionCookie,
  isAdminAuthed,
  setPayrollSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const password = (body as Record<string, unknown> | null)?.password;
  if (typeof password !== "string" || !checkPayrollPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await setPayrollSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  await clearPayrollSessionCookie();
  return NextResponse.json({ ok: true });
}
