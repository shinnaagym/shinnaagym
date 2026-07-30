import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { isValidMonthKey } from "@/lib/date";
import { getCoachSessionCountsForMonth } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isPayrollAuthed())) {
    return NextResponse.json({ error: "급여 계산 비밀번호 확인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const coachId = Number(searchParams.get("coachId"));
  const yearMonth = searchParams.get("yearMonth") ?? "";
  if (!Number.isInteger(coachId) || !isValidMonthKey(yearMonth)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const counts = await getCoachSessionCountsForMonth(coachId, yearMonth);
  return NextResponse.json(counts);
}
