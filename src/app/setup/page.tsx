import { redirect } from "next/navigation";
import { hasAnyUser } from "../auth-actions";
import { AuthForm } from "../login/login-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Primeiro acesso</h1>
        <p className="mb-6 text-sm text-slate-500">
          Crie a conta de administrador. Depois você poderá cadastrar funcionários.
        </p>
        <AuthForm mode="setup" />
      </div>
    </main>
  );
}
