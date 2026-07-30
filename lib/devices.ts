import { query, type AdminDeviceRow } from "@/lib/db";

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
  const { rows } = await query<{ revoked_at: string | null }>(
    `SELECT revoked_at FROM admin_devices WHERE device_id = $1`,
    [deviceId],
  );
  if (rows.length === 0) return false;
  return rows[0].revoked_at !== null;
}

export async function listActiveDevices(): Promise<AdminDeviceRow[]> {
  const { rows } = await query<AdminDeviceRow>(
    `SELECT * FROM admin_devices WHERE revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50`,
  );
  return rows;
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await query(`UPDATE admin_devices SET revoked_at = now() WHERE device_id = $1`, [deviceId]);
}
