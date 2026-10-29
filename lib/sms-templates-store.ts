import { query } from "./db";
import { SMS_TEMPLATE_DEFS, type SmsTemplateKey } from "./sms-templates";

/** 저장된 커스텀 문구가 있으면 그걸, 없으면 lib/sms-templates.ts의 기본
    문구를 반환한다 — key별로 하나도 저장 안 돼 있어도(가장 흔한 경우)
    기존과 똑같이 동작해야 해서, 빠진 key는 항상 기본값으로 채운다. */
export async function getSmsTemplates(): Promise<Record<SmsTemplateKey, string>> {
  const result = await query<{ key: string; body: string }>(`SELECT key, body FROM sms_templates`);
  const overrides = new Map(result.rows.map((r) => [r.key, r.body]));
  const out = {} as Record<SmsTemplateKey, string>;
  for (const def of SMS_TEMPLATE_DEFS) {
    out[def.key] = overrides.get(def.key) ?? def.defaultBody;
  }
  return out;
}

export async function saveSmsTemplate(key: SmsTemplateKey, body: string): Promise<void> {
  await query(
    `INSERT INTO sms_templates (key, body, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [key, body],
  );
}

/** 커스텀 문구를 지워 기본값으로 되돌린다. */
export async function resetSmsTemplate(key: SmsTemplateKey): Promise<void> {
  await query(`DELETE FROM sms_templates WHERE key = $1`, [key]);
}
