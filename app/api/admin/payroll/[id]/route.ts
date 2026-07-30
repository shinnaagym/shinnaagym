import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { deletePayrollRecord } from "@/lib/payroll";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isPayrollAuthed())) {
    return NextResponse.json({ error: "급여 계산 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await deletePayrollRecord(idNum);
  return NextResponse.json({ ok: true });
}
