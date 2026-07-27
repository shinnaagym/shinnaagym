import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addPackage, createMember, listMembers } from "@/lib/schedule";
import type { PtType } from "@/lib/db";

const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const members = await listMembers();
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        phone?: unknown;
        coachId?: unknown;
        notes?: unknown;
        referrer?: unknown;
        availableTimes?: unknown;
        totalSessions?: unknown;
        price?: unknown;
        ptType?: unknown;
      }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const referrer = typeof body?.referrer === "string" ? body.referrer.trim() : "";
  const availableTimes =
    typeof body?.availableTimes === "string" ? body.availableTimes.trim() : "";
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId)
      ? body.coachId
      : null;

  const totalSessions = Number(body?.totalSessions ?? 0);
  const price = Number(body?.price ?? 0);
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    return NextResponse.json({ error: "등록 횟수를 올바르게 입력해주세요." }, { status: 400 });
  }
  const ptType: PtType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : "1:1";

  const member = await createMember({ name, phone, coachId, notes, referrer, availableTimes });
  await addPackage(member.id, totalSessions, price, "최초 등록", ptType);

  return NextResponse.json({ member }, { status: 201 });
}
