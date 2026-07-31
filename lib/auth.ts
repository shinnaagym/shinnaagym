import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isDeviceRevoked } from "@/lib/devices";

export const ADMIN_SESSION_COOKIE_NAME = "shinna_admin_session";
export const ADMIN_DEVICE_COOKIE_NAME = "shinna_device_id";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12시간
const DEVICE_ID_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2년(기기 식별용, 로그아웃해도 유지)

// 급여 계산 페이지는 대표만 봐야 하는 민감한 화면이라, 관리자 공용 비밀번호로
// 로그인한 상태에서도 별도의 2차 비밀번호를 요구한다. 기존 관리자 세션(기기별
// 원격 로그아웃 등)과는 무관한 독립적인 짧은 세션이라 device 개념 없이 단순
// 서명+만료만 검증한다.
export const PAYROLL_SESSION_COOKIE_NAME = "shinna_payroll_session";
const PAYROLL_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2시간

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || "dev-only-insecure-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// "최근 접속 기기" 목록에서 각 로그인을 구분하기 위한 기기 식별자. 로그아웃해도
// 브라우저에는 남아있어, 재로그인 시 같은 기기로 인식되어 하나의 행으로 갱신된다.
export async function getOrCreateDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ADMIN_DEVICE_COOKIE_NAME)?.value;
  if (existing) return existing;
  const deviceId = randomUUID();
  store.set(ADMIN_DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_ID_TTL_MS / 1000,
  });
  return deviceId;
}

export async function getDeviceId(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ADMIN_DEVICE_COOKIE_NAME)?.value;
}

export function createSessionToken(deviceId: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  return `${deviceId}.${expires}.${sign(`admin:${deviceId}:${expires}`)}`;
}

// 서명/만료만 검증해 유효하면 담겨있던 deviceId를 돌려준다(원격 로그아웃 여부는
// 별도로 DB를 조회해야 하므로 여기서는 확인하지 않는다).
function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [deviceId, expiresStr, signature] = parts;
  const expires = Number(expiresStr);
  if (!deviceId || !Number.isFinite(expires) || Date.now() > expires) return null;

  const expected = sign(`admin:${deviceId}:${expiresStr}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return deviceId;
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "951105";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// 서명이 유효한 세션 쿠키에서 deviceId만 뽑아낸다(원격 로그아웃 여부는 확인하지
// 않음). 하트비트처럼 "로그인은 되어 있었지만 지금 로그아웃당했는지" 자체를
// 판별해야 하는 API에서 쓴다.
export async function getSessionDeviceId(): Promise<string | null> {
  const store = await cookies();
  return parseSessionToken(store.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export async function isAdminAuthed(): Promise<boolean> {
  const deviceId = await getSessionDeviceId();
  if (!deviceId) return false;
  return !(await isDeviceRevoked(deviceId));
}

export async function setAdminSessionCookie(deviceId: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE_NAME, createSessionToken(deviceId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE_NAME);
}

export function checkPayrollPassword(candidate: string): boolean {
  const expected = process.env.PAYROLL_PASSWORD || "qw152426350";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function createPayrollSessionToken(): string {
  const expires = Date.now() + PAYROLL_SESSION_TTL_MS;
  return `${expires}.${sign(`payroll:${expires}`)}`;
}

function parsePayrollSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expiresStr, signature] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  const expected = sign(`payroll:${expiresStr}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isPayrollAuthed(): Promise<boolean> {
  const store = await cookies();
  return parsePayrollSessionToken(store.get(PAYROLL_SESSION_COOKIE_NAME)?.value);
}

export async function setPayrollSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(PAYROLL_SESSION_COOKIE_NAME, createPayrollSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PAYROLL_SESSION_TTL_MS / 1000,
  });
}

export async function clearPayrollSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PAYROLL_SESSION_COOKIE_NAME);
}
