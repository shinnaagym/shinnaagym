import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import {
  getDutyOverridesForMonth,
  listBlockedDaysForMonth,
  listCoachLeavesForMonth,
  listPromoPostsForMonth,
} from "@/lib/schedule";

/** 설정 페이지의 토요일 당직 캘린더용 — 한 달치 당직 배정, 휴가(수업 불가 +
    coach_leaves), 홍보 포스팅 기록을 한 번에 내려준다. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const [overrides, blocked, leaves, posts] = await Promise.all([
    getDutyOverridesForMonth(month),
    listBlockedDaysForMonth(month),
    listCoachLeavesForMonth(month),
    listPromoPostsForMonth(month),
  ]);
  return NextResponse.json({ overrides, blocked, leaves, posts });
}
