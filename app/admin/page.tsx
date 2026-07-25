import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-xs">
        <p className="font-display text-2xl mb-8 text-center">신나아짐 관리자</p>
        <LoginForm />
      </div>
    </main>
  );
}
