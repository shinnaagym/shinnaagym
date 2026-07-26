import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  computeMemberProgress,
  getMemberById,
  listPackages,
  listMemberSessions,
  updateMember,
} from "@/lib/schedule";
import type { MemberStatus } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const [progress, packages, sessions] = await Promise.all([
    computeMemberProgress(idNum),
    listPackages(idNum),
    listMemberSessions(idNum),
  ]);
  return NextResponse.json({ member, progress, packages, sessions });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        phone?: unknown;
        coachId?: unknown;
        notes?: unknown;
        status?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  await updateMember(idNum, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
    coachId:
      body.coachId === null
        ? null
        : typeof body.coachId === "number"
          ? body.coachId
          : undefined,
    notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
    status:
      body.status === "active" || body.status === "inactive"
        ? (body.status as MemberStatus)
        : undefined,
  });

  return NextResponse.json({ ok: true });
}
