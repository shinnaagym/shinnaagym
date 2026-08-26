import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import {
  getCoachLeaveYearCounts,
  getDutyOverridesForMonth,
  listBlockedDaysForMonth,
  listCoachLeavesForMonth,
  listPromoPostsForMonth,
} from "@/lib/schedule";

/** 설정 페이지의 토요일 당직 캘린더용 — 한 달치 당직 배정, 휴가(수업 불가 +
    coach_leaves), 홍보 포스팅 기록, 그리고 연 단위 한도(연속 휴가·병가·생일휴가
    등) 표시를 위한 연간 휴가 사용 횟수를 한 번에 내려준다. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const [overrides, blocked, leaves, posts, yearCounts] = await Promise.all([
    getDutyOverridesForMonth(month),
    listBlockedDaysForMonth(month),
    listCoachLeavesForMonth(month),
    listPromoPostsForMonth(month),
    getCoachLeaveYearCounts(month.slice(0, 4)),
  ]);
  return NextResponse.json({ overrides, blocked, leaves, posts, yearCounts });
}
