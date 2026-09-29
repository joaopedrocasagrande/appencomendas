"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botão de envio que fica desabilitado e mostra "Aguarde..." enquanto o formulário é enviado. */
export function SubmitButton({
  className,
  children,
  pendingText = "Aguarde...",
  confirmMessage,
  disabled,
}: {
  className?: string;
  children: ReactNode;
  pendingText?: string;
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
