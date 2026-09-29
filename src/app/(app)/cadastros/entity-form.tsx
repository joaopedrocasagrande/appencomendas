"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { btnDanger, btnPrimary, btnSecondary, Field, Input, Textarea } from "@/components/ui";
import { deleteEntity, saveEntity, type ActionResult } from "./actions";
import type { EntityField } from "./config";

type Row = Record<string, string | number | null> & { id: number };

function Fields({ fields, row }: { fields: EntityField[]; row?: Row }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const value = row?.[f.key] ?? "";
        return (
          <Field key={f.key} label={f.label} hint={f.hint} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "textarea" ? (
              <Textarea name={f.key} defaultValue={String(value)} rows={2} />
            ) : (
              <Input
                name={f.key}
                defaultValue={String(value)}
                required={f.required}
                placeholder={f.placeholder}
                inputMode={f.type === "number" ? "numeric" : undefined}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

export function NewEntityForm({ slug, fields, singular }: { slug: string; fields: EntityField[]; singular: string }) {
  const [state, action, pending] = useActionState(saveEntity.bind(null, slug), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Fields fields={fields} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Salvando..." : `Adicionar ${singular}`}
      </button>
    </form>
  );
}

export function EntityRow({
  slug,
  fields,
  row,
  canDelete,
}: {
  slug: string;
  fields: EntityField[];
  row: Row;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const res = await saveEntity(slug, prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);
  const [delState, delAction, deleting] = useActionState(deleteEntity.bind(null, slug), undefined);

  if (!editing) {
    const extra = fields
      .slice(1)
      .map((f) => (row[f.key] ? `${f.label}: ${row[f.key]}` : null))
      .filter(Boolean);
    return (
      <li className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{row.name}</div>
          {extra.length > 0 && <div className="truncate text-xs text-slate-500">{extra.join(" · ")}</div>}
          {delState?.error && <div className="text-xs text-red-600">{delState.error}</div>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button className={btnSecondary} onClick={() => setEditing(true)}>
            Editar
          </button>
          {canDelete && (
            <form
              action={delAction}
              onSubmit={(e) => {
                if (!confirm(`Excluir "${row.name}"?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={row.id} />
              <button className={btnDanger} disabled={deleting}>
                Excluir
              </button>
            </form>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="py-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={row.id} />
        <Fields fields={fields} row={row} />
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
