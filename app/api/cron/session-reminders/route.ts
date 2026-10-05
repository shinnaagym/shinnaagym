import { NextRequest, NextResponse } from "next/server";
import { sendTomorrowSessionReminders } from "@/lib/session-reminders";

/** Vercel Cron(vercel.json)이 매일 저녁 6시(KST)에 호출 — 내일 PT 수업·상담이
    있는 회원 전원에게 리마인드 문자를 보낸다. CRON_SECRET이 설정돼 있으면
    Vercel이 자동으로 붙이는 Authorization 헤더로 외부 호출을 막는다
    (설정 안 돼 있으면 검증을 건너뛴다 — 로컬 개발 편의를 위함). */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
  }

  const summary = await sendTomorrowSessionReminders();
  return NextResponse.json(summary);
}
