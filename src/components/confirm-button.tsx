"use client";

import type { ReactNode } from "react";
import { SubmitButton } from "./submit-button";

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
    <SubmitButton className={className} confirmMessage={message} pendingText="Excluindo...">
      {children}
    </SubmitButton>
  );
}
