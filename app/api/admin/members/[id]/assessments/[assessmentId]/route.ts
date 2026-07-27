import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAssessmentById } from "@/lib/assessments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id, assessmentId } = await params;
  const idNum = Number(id);
  const assessmentIdNum = Number(assessmentId);
  if (!Number.isInteger(idNum) || !Number.isInteger(assessmentIdNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const assessment = await getAssessmentById(assessmentIdNum);
  if (!assessment || assessment.member_id !== idNum) {
    return NextResponse.json({ error: "평가 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ assessment });
}
