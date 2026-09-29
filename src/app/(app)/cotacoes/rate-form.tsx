"use client";

import { useActionState } from "react";
import { btnPrimary, Field, Input } from "@/components/ui";
import { saveRate } from "./actions";

export function RateForm({ today, current }: { today: string; current?: string }) {
  const [state, action, pending] = useActionState(saveRate, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Dia" className="w-44">
        <Input type="date" name="day" defaultValue={today} required />
      </Field>
      <Field label="$1 = R$" className="w-36">
        <Input name="rate" inputMode="decimal" placeholder="5,42" defaultValue={current} required />
      </Field>
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Salvando..." : "Salvar cotação"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-green-700">Cotação salva.</p>}
    </form>
  );
}
