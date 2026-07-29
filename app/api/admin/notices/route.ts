import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createNotice, listNotices } from "@/lib/notices";
import type { NoticeCategory } from "@/lib/db";

const VALID_CATEGORIES = new Set<NoticeCategory>(["notice", "event"]);

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const notices = await listNotices();
  return NextResponse.json({ notices });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { category?: unknown; title?: unknown; content?: unknown }
    | null;
  const category = typeof body?.category === "string" ? body.category : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!VALID_CATEGORIES.has(category as NoticeCategory)) {
    return NextResponse.json({ error: "잘못된 분류입니다." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  }
  const notice = await createNotice(category as NoticeCategory, title, content);
  return NextResponse.json({ notice }, { status: 201 });
}
