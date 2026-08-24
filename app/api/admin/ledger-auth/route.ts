import { NextRequest, NextResponse } from "next/server";
import {
  checkLedgerPassword,
  clearLedgerSessionCookie,
  isAdminAuthed,
  setLedgerSessionCookie,
} from "@/lib/auth";
import { checkLoginLock, clearLoginAttempts, getClientIp, recordFailedLogin } from "@/lib/login-rate-limit";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const ip = getClientIp(req);

  const lock = await checkLoginLock(ip, "ledger");
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
  if (typeof password !== "string" || !checkLedgerPassword(password)) {
    await recordFailedLogin(ip, "ledger");
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await clearLoginAttempts(ip, "ledger");
  await setLedgerSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  await clearLedgerSessionCookie();
  return NextResponse.json({ ok: true });
}
