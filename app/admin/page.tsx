import { redirect } from "next/navigation";
import Image from "next/image";
import { isAdminAuthed } from "@/lib/auth";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="신나아짐" width={271} height={341} className="h-10 w-auto mb-4" />
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase mb-1">Admin</p>
          <p className="font-display text-xl">신나아짐 관리자</p>
        </div>
        <div className="rounded-2xl bg-white border border-line/60 shadow-sm px-6 py-7">
          <LoginForm recaptchaSiteKey={getRecaptchaSiteKey()} />
        </div>
      </div>
    </main>
  );
}
