import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createSession, findOrCreateMemberByPhone, listSessionsInRange } from "@/lib/schedule";
import { isValidDateKey } from "@/lib/date";
import type { PtType, SessionEntryType } from "@/lib/db";

const VALID_ENTRY_TYPES: SessionEntryType[] = ["session", "consultation", "memo", "blocked"];
const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !isValidDateKey(from) || !isValidDateKey(to)) {
    return NextResponse.json({ error: "잘못된 날짜 범위입니다." }, { status: 400 });
  }
  const sessions = await listSessionsInRange(from, to);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        memberId?: unknown;
        coachId?: unknown;
        date?: unknown;
        hour?: unknown;
        memo?: unknown;
        entryType?: unknown;
        ptType?: unknown;
        newName?: unknown;
        newPhone?: unknown;
      }
    | null;

  const entryType: SessionEntryType =
    typeof body?.entryType === "string" && VALID_ENTRY_TYPES.includes(body.entryType as SessionEntryType)
      ? (body.entryType as SessionEntryType)
      : "session";
  const ptType: PtType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : "1:1";
  const coachId = Number(body?.coachId);
  const date = typeof body?.date === "string" ? body.date : "";
  const hour = Number(body?.hour);
  let memo = typeof body?.memo === "string" ? body.memo : "";

  if (!Number.isInteger(coachId) || !isValidDateKey(date) || !Number.isInteger(hour)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let memberId: number | null = null;

  if (entryType === "session") {
    memberId = Number(body?.memberId);
    if (!Number.isInteger(memberId)) {
      return NextResponse.json({ error: "회원을 선택해주세요." }, { status: 400 });
    }
  } else if (entryType === "consultation") {
    const existingMemberId = Number(body?.memberId);
    if (Number.isInteger(existingMemberId)) {
      memberId = existingMemberId;
    } else {
      const newName = typeof body?.newName === "string" ? body.newName.trim() : "";
      const newPhone = typeof body?.newPhone === "string" ? body.newPhone.trim() : "";
      if (!newName) {
        return NextResponse.json(
          { error: "상담자를 선택하거나 이름을 입력해주세요." },
          { status: 400 },
        );
      }
      const member = await findOrCreateMemberByPhone({
        name: newName,
        phone: newPhone,
        coachId,
        notes: "관리자가 상담 예약으로 직접 등록함",
      });
      memberId = member.id;
    }
  } else if (entryType === "memo" && !memo.trim()) {
    return NextResponse.json({ error: "메모 내용을 입력해주세요." }, { status: 400 });
  } else if (entryType === "blocked" && !memo.trim()) {
    memo = "수업 불가";
  }

  try {
    const session = await createSession({ memberId, coachId, date, hour, memo, entryType, ptType });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "이미 예약된 시간이에요." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "예약 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
