"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

/** Barra fina no topo da tela enquanto a navegação do link está em andamento. */
function PendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-blue-600"
    />
  );
}

/** Link do app: sem pré-carregamento por padrão e com indicador de carregamento. */
export function AppLink({ children, prefetch = false, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link prefetch={prefetch} {...props}>
      {children}
      <PendingBar />
    </Link>
  );
}
