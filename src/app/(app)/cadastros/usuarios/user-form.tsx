"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary, Field, Input, Select } from "@/components/ui";
import { saveUser, type ActionResult } from "../actions";

type UserRow = { id: number; name: string; email: string; role: "admin" | "funcionario"; active: boolean };

function UserFields({ user }: { user?: UserRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome">
        <Input name="name" defaultValue={user?.name} required />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" defaultValue={user?.email} required />
      </Field>
      <Field label={user ? "Nova senha (deixe em branco para manter)" : "Senha"}>
        <Input name="password" type="password" autoComplete="new-password" required={!user} />
      </Field>
      <Field label="Perfil">
        <Select name="role" defaultValue={user?.role ?? "funcionario"}>
          <option value="funcionario">Funcionário</option>
          <option value="admin">Administrador</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={user?.active ?? true} className="size-4" />
        Ativo (pode entrar no app)
      </label>
    </div>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState(saveUser, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <UserFields />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>
        Adicionar usuário
      </button>
    </form>
  );
}

export function UserRowItem({ user }: { user: UserRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const res = await saveUser(prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 py-3">
        <div>
          <div className="font-medium text-slate-900">
            {user.name} {!user.active && <span className="text-xs text-red-600">(desativado)</span>}
          </div>
          <div className="text-xs text-slate-500">
            {user.email} · {user.role === "admin" ? "Administrador" : "Funcionário"}
          </div>
        </div>
        <button className={btnSecondary} onClick={() => setEditing(true)}>
          Editar
        </button>
      </li>
    );
  }
  return (
    <li className="py-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={user.id} />
        <UserFields user={user} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={pending}>
            Salvar
          </button>
          <button type="button" className={btnSecondary} onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}
