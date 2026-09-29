import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyUser } from "../auth-actions";
import { AuthForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Encomendas</h1>
        <p className="mb-6 text-sm text-slate-500">Entre para gerenciar seus pedidos.</p>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
