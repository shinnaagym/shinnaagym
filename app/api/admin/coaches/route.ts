import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addCoach, listCoaches } from "@/lib/schedule";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const coaches = await listCoaches();
  return NextResponse.json({ coaches });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "코치 이름을 입력해주세요." }, { status: 400 });
  }
  try {
    const coach = await addCoach(name);
    return NextResponse.json({ coach }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "이미 등록된 코치 이름입니다." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "코치 등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
