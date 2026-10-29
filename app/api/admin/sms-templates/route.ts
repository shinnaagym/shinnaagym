import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { SMS_TEMPLATE_DEFS, type SmsTemplateKey } from "@/lib/sms-templates";
import { getSmsTemplates, resetSmsTemplate, saveSmsTemplate } from "@/lib/sms-templates-store";

const VALID_KEYS = new Set<string>(SMS_TEMPLATE_DEFS.map((d) => d.key));

function isSmsTemplateKey(v: unknown): v is SmsTemplateKey {
  return typeof v === "string" && VALID_KEYS.has(v);
}

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const templates = await getSmsTemplates();
  return NextResponse.json({ templates });
}

/** body가 비어있으면(전부 지우면) 기본 문구로 되돌리고, 아니면 그 문구를 저장한다. */
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as { key?: unknown; body?: unknown } | null;
  if (!isSmsTemplateKey(payload?.key)) {
    return NextResponse.json({ error: "알 수 없는 문자 종류예요." }, { status: 400 });
  }
  const body = typeof payload?.body === "string" ? payload.body : "";
  if (body.trim().length === 0) {
    await resetSmsTemplate(payload.key);
  } else {
    await saveSmsTemplate(payload.key, body);
  }
  const templates = await getSmsTemplates();
  return NextResponse.json({ templates });
}
