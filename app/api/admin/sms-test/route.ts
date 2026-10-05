import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sendSms } from "@/lib/sms";

/** 설정 페이지의 "문자 발송 테스트" 버튼 — 솔라피 연동(API 키·발신번호)이
    제대로 됐는지 실제 수업 리마인드와 무관하게 확인해볼 수 있다. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!phone) {
    return NextResponse.json({ error: "전화번호를 입력해주세요." }, { status: 400 });
  }

  const result = await sendSms(phone, "[신나아짐] 테스트 문자예요. 이 문자가 도착했다면 문자 발송 설정이 정상이에요 :)");
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "발송에 실패했어요." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
