import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { findOrCreateMemberByPhone } from "@/lib/schedule";

/**
 * 아직 정식 등록(패키지·계약서) 전인 상담자를 이름+연락처만으로 빠르게
 * 등록/조회한다 — 초진 문진표·평가지를 상담 단계에서 바로 작성할 수 있도록
 * 회원 레코드만 먼저 만들어준다.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { name?: unknown; phone?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  const member = await findOrCreateMemberByPhone({
    name,
    phone,
    coachId: null,
    notes: "초진 문진표/평가지 작성을 위해 상담자로 등록됨",
  });

  return NextResponse.json({ member });
}
