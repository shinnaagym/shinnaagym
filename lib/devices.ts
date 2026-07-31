import { query, type AdminDeviceRow } from "@/lib/db";

// isAdminAuthed()는 모든 관리자 페이지·API 요청마다 호출되는 핫패스라, 매번
// DB를 조회하면(특히 서버리스 콜드 스타트나 Neon 같은 절전형 DB에서) 그 자체가
// 체감 로딩 지연의 큰 원인이 된다. 같은 서버 인스턴스가 살아있는 동안에는
// 기기별 로그아웃 여부를 짧게(30초) 메모리에 캐시해 반복 조회를 없앤다 —
// 원격 로그아웃 반영이 최대 30초 정도 늦어질 수 있지만(하트비트 주기와 비슷한
// 수준), 페이지 이동마다 DB 왕복이 생기는 것보다 훨씬 낫다.
const REVOKED_CACHE_TTL_MS = 30_000;
const revokedCache = new Map<string, { revoked: boolean; expiresAt: number }>();

function setRevokedCache(deviceId: string, revoked: boolean): void {
  revokedCache.set(deviceId, { revoked, expiresAt: Date.now() + REVOKED_CACHE_TTL_MS });
}

export function labelFromUserAgent(ua: string): string {
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "기타 기기";
}

export async function upsertDeviceOnLogin(
  deviceId: string,
  deviceLabel: string,
  appVersion: string,
): Promise<void> {
  await query(
    `INSERT INTO admin_devices (device_id, device_label, app_version, last_seen_at, revoked_at)
     VALUES ($1, $2, $3, now(), NULL)
     ON CONFLICT (device_id) DO UPDATE SET
       device_label = excluded.device_label,
       app_version = excluded.app_version,
       last_seen_at = now(),
       revoked_at = NULL`,
    [deviceId, deviceLabel, appVersion],
  );
  setRevokedCache(deviceId, false);
}

// 로그인 없이도(=페이지 접속 중 하트비트만으로도) 최신 버전/접속시각을 갱신하되,
// 이미 로그아웃(revoked_at)된 기기는 하트비트만으로 되살리지 않는다.
export async function touchDeviceHeartbeat(deviceId: string, appVersion: string): Promise<void> {
  await query(
    `UPDATE admin_devices
     SET app_version = $2, last_seen_at = now()
     WHERE device_id = $1 AND revoked_at IS NULL`,
    [deviceId, appVersion],
  );
}

export async function isDeviceRevoked(deviceId: string): Promise<boolean> {
  const cached = revokedCache.get(deviceId);
  if (cached && cached.expiresAt > Date.now()) return cached.revoked;

  const { rows } = await query<{ revoked_at: string | null }>(
    `SELECT revoked_at FROM admin_devices WHERE device_id = $1`,
    [deviceId],
  );
  const revoked = rows.length > 0 && rows[0].revoked_at !== null;
  setRevokedCache(deviceId, revoked);
  return revoked;
}

export async function listActiveDevices(): Promise<AdminDeviceRow[]> {
  const { rows } = await query<AdminDeviceRow>(
    `SELECT * FROM admin_devices WHERE revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50`,
  );
  return rows;
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await query(`UPDATE admin_devices SET revoked_at = now() WHERE device_id = $1`, [deviceId]);
  setRevokedCache(deviceId, true);
}
