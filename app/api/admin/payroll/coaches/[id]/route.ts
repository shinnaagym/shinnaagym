import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, isPayrollAuthed } from "@/lib/auth";
import { setCoachDeclaredMonthlyCompensation, setCoachMandatorySessionsOverride } from "@/lib/schedule";

// 직원별 신고 보수월액·의무수업 고정은 급여 계산에 쓰이는 민감한 정보라, 일반
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

// 두 필드(보수월액·의무수업 고정)는 서로 독립적이라, 요청 본문에 들어있는
// 필드만 그 값으로 바꾼다(둘 다 보낼 필요 없음). null은 "고정 해제"다.
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
    | { declaredMonthlyCompensation?: unknown; mandatorySessionsOverride?: unknown }
    | null;

  const response: { declaredMonthlyCompensation?: number | null; mandatorySessionsOverride?: number | null } = {};

  if (body && "declaredMonthlyCompensation" in body) {
    const raw = body.declaredMonthlyCompensation;
    if (raw === null) {
      response.declaredMonthlyCompensation = null;
    } else if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      response.declaredMonthlyCompensation = Math.round(raw);
    } else {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await setCoachDeclaredMonthlyCompensation(idNum, response.declaredMonthlyCompensation);
  }

  if (body && "mandatorySessionsOverride" in body) {
    const raw = body.mandatorySessionsOverride;
    if (raw === null) {
      response.mandatorySessionsOverride = null;
    } else if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
      response.mandatorySessionsOverride = raw;
    } else {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await setCoachMandatorySessionsOverride(idNum, response.mandatorySessionsOverride);
  }

  if (Object.keys(response).length === 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...response });
}
