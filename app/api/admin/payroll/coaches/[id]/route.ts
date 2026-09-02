import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { setCoachDeclaredMonthlyCompensation } from "@/lib/schedule";

// 직원별 신고 보수월액은 4대보험 산정 기준으로 쓰이는 민감한 정보라, 일반
// 관리자 인증(isAdminAuthed)만으로는 부족하고 급여 계산 페이지와 같은 2차
// 비밀번호(isPayrollAuthed)까지 확인한다 — app/api/admin/coaches/[id]/route.ts의
// 일반 코치 정보 수정(전화번호·생일 등)과는 별도로 이 라우트를 둔 이유다.
async function requirePayrollAccess() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (!(await isPayrollAuthed())) {
    return NextResponse.json({ error: "급여 계산 비밀번호 확인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requirePayrollAccess();
  if (denied) return denied;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { declaredMonthlyCompensation?: unknown }
    | null;
  const raw = body?.declaredMonthlyCompensation;
  let amount: number | null;
  if (raw === null) {
    amount = null;
  } else if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    amount = Math.round(raw);
  } else {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  await setCoachDeclaredMonthlyCompensation(idNum, amount);
  return NextResponse.json({ ok: true, declaredMonthlyCompensation: amount });
}
