import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addPackage, createMember, listMembers } from "@/lib/schedule";

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
        totalSessions?: unknown;
        price?: unknown;
      }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId)
      ? body.coachId
      : null;

  const totalSessions = Number(body?.totalSessions ?? 0);
  const price = Number(body?.price ?? 0);
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    return NextResponse.json({ error: "등록 횟수를 올바르게 입력해주세요." }, { status: 400 });
  }

  const member = await createMember({ name, phone, coachId, notes });
  await addPackage(member.id, totalSessions, price, "최초 등록");

  return NextResponse.json({ member }, { status: 201 });
}
