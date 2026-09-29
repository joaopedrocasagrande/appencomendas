"use client";

import { useActionState, useRef, useState } from "react";
import { btnPrimary, Field, Input, Select } from "@/components/ui";
import { CURRENCIES, type Currency } from "@/db/schema";
import { toInput } from "@/lib/format";
import { rateForDay } from "../../cotacoes/actions";
import { addPayment, type ActionResult } from "../actions";

export function PaymentForm({
  orderId,
  orderCurrency,
  today,
  todayRate,
  methods,
  suggestedAmount,
}: {
  orderId: number;
  orderCurrency: Currency;
  today: string;
  todayRate: string;
  methods: string[];
  suggestedAmount: string;
}) {
  const [rate, setRate] = useState(todayRate);
  const [currency, setCurrency] = useState<Currency>(orderCurrency);
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const res = await addPayment(orderId, prev, fd);
    if (res?.ok) {
      ref.current?.reset();
      setCurrency(orderCurrency);
      setRate(todayRate);
    }
    return res;
  }, undefined);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <datalist id="dl-methods">
        {methods.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Data">
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
          <Input name="amount" inputMode="decimal" placeholder={suggestedAmount} required />
        </Field>
        <Field label="Moeda">
          <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cotação (US$ 1 = R$)">
          <Input name="exchangeRate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Forma de pagamento" className="col-span-2 sm:col-span-1">
          <Input name="method" list="dl-methods" placeholder="PIX, Wise..." />
        </Field>
        <Field label="Observação" className="col-span-2 sm:col-span-5">
          <Input name="notes" />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Lançando..." : "Lançar pagamento"}
      </button>
    </form>
  );
}
