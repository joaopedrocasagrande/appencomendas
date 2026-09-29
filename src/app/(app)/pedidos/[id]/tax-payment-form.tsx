"use client";

import { useActionState, useRef, useState } from "react";
import { btnPrimary, Field, Input, Select } from "@/components/ui";
import { CURRENCIES, type Currency } from "@/db/schema";
import { toInput } from "@/lib/format";
import { rateForDay } from "../../cotacoes/actions";
import { addTaxPayment, type ActionResult } from "../actions";

export function TaxPaymentForm({
  orderId,
  today,
  todayRate,
  trackings,
}: {
  orderId: number;
  today: string;
  todayRate: string;
  trackings: { id: number; code: string; label: string | null }[];
}) {
  const [rate, setRate] = useState(todayRate);
  const [currency, setCurrency] = useState<Currency>("BRL");
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const res = await addTaxPayment(orderId, prev, fd);
    if (res?.ok) {
      ref.current?.reset();
      setCurrency("BRL");
      setRate(todayRate);
    }
    return res;
  }, undefined);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Data do pagamento">
          <Input
            type="date"
            name="paidOn"
            defaultValue={today}
            required
            onChange={async (e) => {
              const r = await rateForDay(e.target.value);
              if (r) setRate(toInput(r.rate));
            }}
          />
        </Field>
        <Field label="Valor pago">
          <Input name="amount" inputMode="decimal" required />
        </Field>
        <Field label="Moeda">
          <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {currency === "USD" && (
          <Field label="Cotação ($1 = R$)">
            <Input name="exchangeRate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        )}
        <Field label="Referente a" className="col-span-2">
          <Select name="trackingId" defaultValue="">
            <option value="">Pedido todo</option>
            {trackings.map((t) => (
              <option key={t.id} value={t.id}>
                Pacote {t.code}
                {t.label ? ` (${t.label})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observação" className="col-span-2">
          <Input name="notes" />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Lançando..." : "Lançar imposto"}
      </button>
    </form>
  );
}
