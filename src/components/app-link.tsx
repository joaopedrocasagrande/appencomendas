"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentProps, type MouseEvent } from "react";

// Se a troca de tela não acontecer nesse tempo, recarrega a página direto no destino.
const FALLBACK_MS = 5000;

/** Aviso visível enquanto a navegação do link está em andamento. */
function PendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1.5 animate-pulse bg-blue-600" />
      <span
        role="status"
        className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg md:bottom-8"
      >
        Carregando...
      </span>
    </>
  );
}

/**
 * Link do app: sem pré-carregamento por padrão, com aviso de carregamento e um plano B:
 * se a navegação travar (ex.: aba aberta de uma versão anterior do app), faz o
 * carregamento completo da página de destino.
 */
export function AppLink({ children, prefetch = false, onClick, href, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mudou de tela: cancela o plano B.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, [pathname]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const target = new URL(typeof href === "string" ? href : String(href.pathname ?? ""), window.location.href);
    if (typeof href !== "string" && href.query) {
      for (const [k, v] of Object.entries(href.query)) if (v != null) target.searchParams.set(k, String(v));
    }
    if (target.pathname === window.location.pathname && target.search === window.location.search) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (window.location.pathname !== target.pathname) window.location.assign(target.href);
    }, FALLBACK_MS);
  }

  return (
    <Link prefetch={prefetch} href={href} onClick={handleClick} {...props}>
      {children}
      <PendingIndicator />
    </Link>
  );
}
