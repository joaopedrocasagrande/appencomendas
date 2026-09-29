"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/painel", label: "Painel", icon: "📊" },
  { href: "/pedidos", label: "Pedidos", icon: "📦" },
  { href: "/pedidos/novo", label: "Novo", icon: "➕" },
  { href: "/cotacoes", label: "Dólar", icon: "💵" },
  { href: "/cadastros", label: "Cadastros", icon: "🗂️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/pedidos") return pathname === "/pedidos" || /^\/pedidos\/\d+/.test(pathname);
  return pathname.startsWith(href);
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            isActive(pathname, l.href) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx(
            "flex flex-col items-center gap-0.5 py-2 text-xs",
            isActive(pathname, l.href) ? "font-semibold text-blue-700" : "text-slate-500",
          )}
        >
          <span className="text-lg leading-none">{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
