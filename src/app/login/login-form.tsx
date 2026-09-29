"use client";

import { useActionState } from "react";
import { login, setupAdmin } from "../auth-actions";
import { btnPrimary, Field, Input } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : setupAdmin, undefined);
  return (
    <form action={action} className="space-y-4">
      {mode === "setup" && (
        <Field label="Seu nome">
          <Input name="name" required autoComplete="name" />
        </Field>
      )}
      <Field label="E-mail">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Senha">
        <Input
          name="password"
          type="password"
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "setup" ? 6 : undefined}
        />
      </Field>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className={`${btnPrimary} w-full`} disabled={pending}>
        {pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar administrador"}
      </button>
    </form>
  );
}
