import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAllCoachScheduleStats } from "@/lib/schedule";
import { isValidDateKey, isValidMonthKey } from "@/lib/date";

// 스케줄표 KPI 카드(이번 달 수업수·상담수·노쇼 등)용 코치별 통계. 노쇼 처리/
// 기록 삭제처럼 class_sessions를 직접 바꾸는 빠른 동작(quickPatch/quickDelete)
// 뒤에 스케줄 그리드가 이 라우트를 다시 호출해, 서버에서 처음 내려준 통계가
// 그대로 멈춰 있지 않고 최신 상태로 갱신되게 한다.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const monthKey = req.nextUrl.searchParams.get("monthKey") ?? "";
  const weekStart = req.nextUrl.searchParams.get("weekStart") ?? "";
  const weekEnd = req.nextUrl.searchParams.get("weekEnd") ?? "";
  if (!isValidMonthKey(monthKey) || !isValidDateKey(weekStart) || !isValidDateKey(weekEnd)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const stats = await getAllCoachScheduleStats(monthKey, weekStart, weekEnd);
  return NextResponse.json({ stats: Object.fromEntries(stats) });
}
