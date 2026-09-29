import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, todayISO } from "@/lib/format";
import { getRateFor } from "@/lib/rates";
import { logout } from "../auth-actions";
import { DesktopNav, MobileNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const rate = await getRateFor();
  const isToday = rate?.day === todayISO();

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-4">
            <Link href="/painel" className="text-lg font-bold text-blue-700">
              Encomendas
            </Link>
            <DesktopNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/cotacoes"
              className={
                isToday
                  ? "rounded-md bg-slate-100 px-2 py-1 text-slate-700"
                  : "rounded-md bg-amber-100 px-2 py-1 text-amber-800"
              }
              title={rate ? `Cotação de ${fmtDate(rate.day)}` : "Nenhuma cotação cadastrada"}
            >
              $1 = {rate ? fmtMoney(rate.rate) : "definir"}
              {rate && !isToday && " ⚠"}
            </Link>
            <span className="hidden text-slate-500 sm:inline">
              {user.name}
              {user.role === "admin" ? " (admin)" : ""}
            </span>
            <form action={logout}>
              <button className="text-slate-500 hover:text-slate-800">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
      <MobileNav />
    </div>
  );
}
