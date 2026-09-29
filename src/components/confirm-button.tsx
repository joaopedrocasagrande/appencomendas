"use client";

import type { ReactNode } from "react";

/** Botão de envio que pede confirmação antes (usado para exclusões). */
export function ConfirmButton({
  message,
  className,
  children = "Excluir",
}: {
  message: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
