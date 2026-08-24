import { query } from "./db";

/** 관리자 공용 비밀번호와 급여·가계부 2차 비밀번호는 서로 다른 시도라, 한쪽
    실패가 다른 쪽 잠금에 영향을 주지 않도록 scope로 분리해서 센다. */
export type LoginScope = "admin" | "payroll" | "ledger";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// 이 시간보다 오래된 실패는 "이어지는 시도"로 보지 않고 카운트를 새로 시작한다
// (예: 몇 주 전에 실수로 5번 틀렸던 기록이 지금 잠금에 영향을 주면 안 됨).
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Vercel 같은 프록시 뒤에서는 요청 객체의 소켓 주소가 아니라 x-forwarded-for
    헤더에 실제 클라이언트 IP가 담긴다(맨 앞 값이 클라이언트, 그 뒤는 중간
    프록시들). 헤더가 없으면(로컬 개발 등) 구분할 수 없으니 하나의 값으로
    묶는다 — 로컬에서는 브루트포스 시나리오 자체가 없으므로 문제 없다. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface LoginLockStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

/** 비밀번호를 확인하기 전에 먼저 호출한다 — 잠긴 IP는 비밀번호가 맞는지조차
    확인하지 않고 바로 거절해서, 잠금 중에도 무의미한 시도가 계속되는 걸 막는다. */
export async function checkLoginLock(ip: string, scope: LoginScope): Promise<LoginLockStatus> {
  const { rows } = await query<{ locked_until: string | null }>(
    `SELECT locked_until FROM login_attempts WHERE ip = $1 AND scope = $2`,
    [ip, scope],
  );
  const lockedUntil = rows[0]?.locked_until;
  if (!lockedUntil) return { locked: false };
  const remainingMs = new Date(lockedUntil).getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false };
  return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export async function recordFailedLogin(ip: string, scope: LoginScope): Promise<void> {
  const { rows } = await query<{ failed_count: number; first_failed_at: string | null }>(
    `SELECT failed_count, first_failed_at FROM login_attempts WHERE ip = $1 AND scope = $2`,
    [ip, scope],
  );
  const existing = rows[0];
  const windowExpired =
    !existing?.first_failed_at ||
    Date.now() - new Date(existing.first_failed_at).getTime() > ATTEMPT_WINDOW_MS;

  const newCount = windowExpired ? 1 : existing.failed_count + 1;
  const firstFailedAt = windowExpired ? new Date() : new Date(existing!.first_failed_at!);
  const lockedUntil = newCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

  await query(
    `INSERT INTO login_attempts (ip, scope, failed_count, first_failed_at, locked_until)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ip, scope) DO UPDATE SET
       failed_count = EXCLUDED.failed_count,
       first_failed_at = EXCLUDED.first_failed_at,
       locked_until = EXCLUDED.locked_until`,
    [ip, scope, newCount, firstFailedAt, lockedUntil],
  );
}

/** 로그인에 성공하면 그 IP의 실패 기록을 지운다(다음 실수가 다시 처음부터 카운트되게). */
export async function clearLoginAttempts(ip: string, scope: LoginScope): Promise<void> {
  await query(`DELETE FROM login_attempts WHERE ip = $1 AND scope = $2`, [ip, scope]);
}
