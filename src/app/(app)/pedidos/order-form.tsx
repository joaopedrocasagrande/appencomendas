"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  cx,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { CURRENCIES, ORDER_STATUSES, type Currency } from "@/db/schema";
import { computeOrderTotals, otherCurrency } from "@/lib/finance";
import { addDays, fmtMoney, fmtNumber, parseDecimal, toInput } from "@/lib/format";
import { ORDER_STATUS_LABEL, SIZE_SUGGESTIONS, VARIANT_SUGGESTIONS } from "@/lib/labels";
import type { Options } from "@/lib/orders";
import { rateForDay } from "../cotacoes/actions";
import { saveOrder } from "./actions";
import type { ExpenseInput, ItemInput, OrderInput } from "./types";

type ItemState = Omit<ItemInput, "sizes"> & {
  key: string;
  autoTotal: boolean;
  sizes: { size: string; qty: string }[] | null;
};
type ExpenseState = ExpenseInput & { key: string };
type FormState = Omit<OrderInput, "items" | "expenses">;

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

const emptyItem = (): ItemState => ({
  key: newKey(),
  productName: "",
  variant: "",
  boxes: "",
  piecesPerBox: "",
  grids: "",
  piecesPerGrid: "12",
  totalPieces: "",
  unitPrice: "",
  sizes: null,
  autoTotal: true,
});

function suggestedTotal(i: ItemState) {
  const boxes = parseDecimal(i.boxes);
  const ppb = parseDecimal(i.piecesPerBox);
  if (boxes && ppb) return Math.round(boxes * ppb);
  const grids = parseDecimal(i.grids);
  const ppg = parseDecimal(i.piecesPerGrid);
  if (grids && ppg) return Math.round(grids * ppg);
  return null;
}

export type OrderFormInitial = OrderInput & {
  items: (ItemInput & { sizes?: { size: string; qty: string }[] | null })[];
};

export function OrderForm({
  initial,
  options,
  defaultRate,
  today,
}: {
  initial?: OrderFormInitial;
  options: Options;
  defaultRate: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Depois que o usuário digita a cotação manualmente, não sobrescrevemos mais.
  const [rateTouched, setRateTouched] = useState(!!initial?.exchangeRate);

  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { items, expenses, ...rest } = initial;
      return rest;
    }
    return {
      title: "",
      supplierName: "",
      orderDate: today,
      expectedDate: "",
      transportModeName: "",
      carrierName: "",
      currency: "BRL",
      exchangeRate: defaultRate,
      freight: "",
      discount: "",
      hasTax: false,
      taxIncluded: false,
      taxAmount: "",
      taxPaid: false,
      status: "confirmado",
      notes: "",
      needsReview: false,
    };
  });
  const [items, setItems] = useState<ItemState[]>(() =>
    initial?.items.length
      ? initial.items.map((i) => ({
          ...(i as ItemState),
          key: newKey(),
          autoTotal: false,
          sizes: i.sizes ? i.sizes.map((x) => ({ size: x.size, qty: x.qty ?? "" })) : null,
        }))
      : [emptyItem()],
  );
  const [expenses, setExpenses] = useState<ExpenseState[]>(() =>
    (initial?.expenses ?? []).map((e) => ({ ...e, key: newKey() }) as ExpenseState),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const updateItem = (key: string, patch: Partial<ItemState>) =>
    setItems((list) =>
      list.map((i) => {
        if (i.key !== key) return i;
        const next = { ...i, ...patch };
        if ("totalPieces" in patch) next.autoTotal = patch.totalPieces === "";
        if (next.autoTotal && !("totalPieces" in patch)) {
          const s = suggestedTotal(next);
          if (s !== null) next.totalPieces = String(s);
        }
        return next;
      }),
    );

  const updateExpense = (key: string, patch: Partial<ExpenseState>) =>
    setExpenses((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  // Sugere cotação ao trocar a data do pedido
  async function onOrderDateChange(value: string) {
    set("orderDate", value);
    if (value && !rateTouched) {
      const r = await rateForDay(value);
      if (r) set("exchangeRate", toInput(r.rate));
    }
    suggestExpected(value, form.transportModeName ?? "");
  }

  function suggestExpected(orderDate: string, modeName: string) {
    const mode = options.modes.find((m) => m.name.toLowerCase() === modeName.trim().toLowerCase());
    if (orderDate && mode?.defaultDays && !form.expectedDate) {
      set("expectedDate", addDays(orderDate, mode.defaultDays));
    }
  }

  const cur = form.currency as Currency;
  const rate = parseDecimal(form.exchangeRate);

  const totals = useMemo(
    () =>
      computeOrderTotals({
        currency: cur,
        exchangeRate: rate,
        freight: parseDecimal(form.freight),
        discount: parseDecimal(form.discount),
        hasTax: !!form.hasTax,
        taxIncluded: !!form.taxIncluded,
        taxAmount: parseDecimal(form.taxAmount),
        taxPaid: !!form.taxPaid,
        items: items.map((i) => ({
          totalPieces: parseDecimal(i.totalPieces) ?? 0,
          unitPrice: parseDecimal(i.unitPrice),
        })),
        expenses: expenses.map((e) => ({
          amount: parseDecimal(e.amount),
          currency: e.currency as Currency,
          chargedBySupplier: e.chargedBySupplier,
          paid: e.paid,
        })),
        trackings: [],
        payments: [],
      }),
    [form, items, expenses, cur, rate],
  );

  const other = (v: number) => {
    const o = otherCurrency(v, cur, rate);
    return o ? `≈ ${fmtMoney(o.value, o.currency)}` : null;
  };

  function submit() {
    setError(null);
    const payload: OrderInput = {
      ...form,
      items: items.map((i) => ({
        id: i.id,
        productName: i.productName ?? "",
        variant: i.variant,
        boxes: i.boxes,
        piecesPerBox: i.piecesPerBox,
        grids: i.grids,
        piecesPerGrid: i.piecesPerGrid,
        totalPieces: i.totalPieces,
        unitPrice: i.unitPrice,
        sizes: i.sizes,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        description: e.description ?? "",
        amount: e.amount,
        currency: e.currency,
        chargedBySupplier: e.chargedBySupplier,
        paid: e.paid,
      })),
    };
    startTransition(async () => {
      try {
        const res = await saveOrder(payload);
        if (res.error) setError(res.error);
        else if (res.id) {
          router.push(`/pedidos/${res.id}`);
          router.refresh();
        }
      } catch {
        setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <datalist id="dl-suppliers">
        {options.suppliers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="dl-products">
        {options.products.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="dl-modes">
        {options.modes.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="dl-carriers">
        {options.carriers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="dl-variants">
        {VARIANT_SUGGESTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="dl-sizes">
        {SIZE_SUGGESTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <Card title="Dados do pedido">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Título do pedido" className="sm:col-span-2 lg:col-span-3">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: Pedido Joao ATK - Aéreo Diversos"
              required
            />
          </Field>
          <Field label="Fornecedor" hint="Digite um nome novo para cadastrar na hora.">
            <Input
              list="dl-suppliers"
              value={form.supplierName}
              onChange={(e) => set("supplierName", e.target.value)}
            />
          </Field>
          <Field label="Status do pedido">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data do pedido">
            <Input type="date" value={form.orderDate} onChange={(e) => onOrderDateChange(e.target.value)} />
          </Field>
          <Field label="Modalidade de transporte">
            <Input
              list="dl-modes"
              value={form.transportModeName}
              onChange={(e) => set("transportModeName", e.target.value)}
              onBlur={(e) => suggestExpected(form.orderDate ?? "", e.target.value)}
              placeholder="Aéreo, Marítimo..."
            />
          </Field>
          <Field label="Transportadora">
            <Input
              list="dl-carriers"
              value={form.carrierName}
              onChange={(e) => set("carrierName", e.target.value)}
              placeholder="Correios - Sedex, Fedex..."
            />
          </Field>
          <Field label="Previsão de recebimento">
            <Input type="date" value={form.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} />
          </Field>
          <Field label="Moeda do pedido">
            <Select value={form.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === "USD" ? "Dólar (US$)" : "Real (R$)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cotação do pedido (US$ 1 = R$)" hint="Sugerida pela cotação do dia do pedido.">
            <Input
              inputMode="decimal"
              value={form.exchangeRate}
              onChange={(e) => {
                setRateTouched(true);
                set("exchangeRate", e.target.value);
              }}
              placeholder="5,42"
            />
          </Field>
        </div>
      </Card>

      <Card
        title={`Itens (${items.length})`}
        actions={
          <button type="button" className={btnSecondary} onClick={() => setItems((l) => [...l, emptyItem()])}>
            + Item
          </button>
        }
      >
        <div className="space-y-4">
          {items.map((item, idx) => (
            <ItemEditor
              key={item.key}
              index={idx}
              item={item}
              currency={cur}
              onChange={(patch) => updateItem(item.key, patch)}
              onRemove={items.length > 1 ? () => setItems((l) => l.filter((i) => i.key !== item.key)) : undefined}
            />
          ))}
          <button
            type="button"
            className={cx(btnSecondary, "w-full")}
            onClick={() => setItems((l) => [...l, emptyItem()])}
          >
            + Adicionar item
          </button>
        </div>
      </Card>

      <Card title="Frete, desconto e imposto">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={`Frete (${cur})`}>
            <Input inputMode="decimal" value={form.freight} onChange={(e) => set("freight", e.target.value)} />
          </Field>
          <Field label={`Desconto (${cur})`}>
            <Input inputMode="decimal" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              className="size-4"
              checked={!!form.hasTax}
              onChange={(e) => set("hasTax", e.target.checked)}
            />
            Este pedido tem imposto
          </label>
          {form.hasTax && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={`Valor do imposto (${cur})`}>
                <Input inputMode="decimal" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!!form.taxIncluded}
                  onChange={(e) => set("taxIncluded", e.target.checked)}
                />
                Imposto incluso no valor do pedido
              </label>
              {!form.taxIncluded && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!form.taxPaid}
                    onChange={(e) => set("taxPaid", e.target.checked)}
                  />
                  Imposto já pago
                </label>
              )}
              <p className="text-xs text-slate-500 sm:col-span-3">
                {form.taxIncluded
                  ? "Incluso: o imposto já está dentro do valor pago ao fornecedor (fica só como informação)."
                  : "Não incluso: o imposto é pago à parte e entra nos custos extras do pedido."}{" "}
                Impostos cobrados por pacote podem ser lançados em cada rastreio.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Outras despesas"
        actions={
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              setExpenses((l) => [
                ...l,
                { key: newKey(), description: "", amount: "", currency: cur, chargedBySupplier: true, paid: false },
              ])
            }
          >
            + Despesa
          </button>
        }
      >
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500">Taxas, envio interno, despachante etc. Nenhuma despesa lançada.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((e) => (
              <div key={e.key} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
                <Field label="Descrição" className="sm:col-span-5">
                  <Input value={e.description} onChange={(ev) => updateExpense(e.key, { description: ev.target.value })} />
                </Field>
                <Field label="Valor" className="sm:col-span-3">
                  <Input inputMode="decimal" value={e.amount} onChange={(ev) => updateExpense(e.key, { amount: ev.target.value })} />
                </Field>
                <Field label="Moeda" className="sm:col-span-2">
                  <Select value={e.currency} onChange={(ev) => updateExpense(e.key, { currency: ev.target.value as Currency })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="button"
                    className={cx(btnSmall, "w-full py-2 text-red-600")}
                    onClick={() => setExpenses((l) => l.filter((x) => x.key !== e.key))}
                  >
                    Remover
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700 sm:col-span-12">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={e.chargedBySupplier}
                      onChange={(ev) => updateExpense(e.key, { chargedBySupplier: ev.target.checked })}
                    />
                    Cobrada pelo fornecedor (entra no total a pagar a ele)
                  </label>
                  {!e.chargedBySupplier && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={e.paid}
                        onChange={(ev) => updateExpense(e.key, { paid: ev.target.checked })}
                      />
                      Já paga
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Observações">
        <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4"
            checked={!!form.needsReview}
            onChange={(e) => set("needsReview", e.target.checked)}
          />
          Marcar como &quot;precisa de revisão&quot;
        </label>
      </Card>

      <div className="sticky bottom-16 z-10 rounded-xl border border-blue-200 bg-white p-4 shadow-lg md:bottom-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Peças</div>
            <div className="font-semibold">{fmtNumber(totals.pieces, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Produtos</div>
            <div className="font-semibold">{fmtMoney(totals.itemsTotal, cur)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total ao fornecedor</div>
            <div className="font-semibold text-blue-700">{fmtMoney(totals.supplierTotal, cur)}</div>
            <div className="text-xs text-slate-500">{other(totals.supplierTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Custos à parte</div>
            <div className="font-semibold">{fmtMoney(totals.extrasBRL, "BRL")}</div>
          </div>
        </div>
        {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button className={cx(btnPrimary, "flex-1 sm:flex-none")} disabled={pending}>
            {pending ? "Salvando..." : "Salvar pedido"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

function ItemEditor({
  index,
  item,
  currency,
  onChange,
  onRemove,
}: {
  index: number;
  item: ItemState;
  currency: Currency;
  onChange: (patch: Partial<ItemState>) => void;
  onRemove?: () => void;
}) {
  const total = (parseDecimal(item.totalPieces) ?? 0) * (parseDecimal(item.unitPrice) ?? 0);
  const suggestion = suggestedTotal(item);
  const sizesSum = item.sizes?.reduce((s, x) => s + (parseDecimal(x.qty) ?? 0), 0) ?? 0;
  const totalPieces = parseDecimal(item.totalPieces) ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-slate-500">Item {index + 1}</span>
        {onRemove && (
          <button type="button" className="text-xs text-red-600 hover:underline" onClick={onRemove}>
            Remover
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Field label="Produto" className="col-span-2 sm:col-span-4">
          <Input
            list="dl-products"
            value={item.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder="Digite ou escolha"
            required
          />
        </Field>
        <Field label="Variação" className="col-span-2 sm:col-span-2">
          <Input list="dl-variants" value={item.variant} onChange={(e) => onChange({ variant: e.target.value })} />
        </Field>
        <Field label="Caixas">
          <Input inputMode="decimal" value={item.boxes} onChange={(e) => onChange({ boxes: e.target.value })} />
        </Field>
        <Field label="Peças/caixa">
          <Input
            inputMode="decimal"
            value={item.piecesPerBox}
            onChange={(e) => onChange({ piecesPerBox: e.target.value })}
          />
        </Field>
        <Field label="Grades">
          <Input inputMode="decimal" value={item.grids} onChange={(e) => onChange({ grids: e.target.value })} />
        </Field>
        <Field label="Peças/grade">
          <Input
            inputMode="decimal"
            value={item.piecesPerGrid}
            onChange={(e) => onChange({ piecesPerGrid: e.target.value })}
          />
        </Field>
        <Field
          label="Total de peças"
          hint={
            suggestion !== null && suggestion !== totalPieces ? (
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => onChange({ totalPieces: String(suggestion) })}
              >
                Calculado: {suggestion}. Usar
              </button>
            ) : undefined
          }
        >
          <Input
            inputMode="numeric"
            value={item.totalPieces}
            onChange={(e) => onChange({ totalPieces: e.target.value })}
            className="font-semibold"
          />
        </Field>
        <Field label={`Valor unit. (${currency})`}>
          <Input inputMode="decimal" value={item.unitPrice} onChange={(e) => onChange({ unitPrice: e.target.value })} />
        </Field>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline"
          onClick={() =>
            onChange({
              sizes: item.sizes ? null : ["P", "M", "G", "GG", "XGG"].map((size) => ({ size, qty: "" })),
            })
          }
        >
          {item.sizes ? "Não controlar tamanhos" : "Controlar tamanhos (opcional)"}
        </button>
        <span className="text-sm font-semibold text-slate-800">Total: {fmtMoney(total, currency)}</span>
      </div>

      {item.sizes && (
        <div className="mt-2 rounded-md bg-slate-50 p-2">
          <div className="flex flex-wrap gap-2">
            {item.sizes.map((s, i) => (
              <div key={i} className="flex w-40 items-center gap-1">
                <Input
                  list="dl-sizes"
                  value={s.size}
                  className="w-16 shrink-0 px-1 text-center"
                  onChange={(e) =>
                    onChange({ sizes: item.sizes!.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)) })
                  }
                />
                <Input
                  inputMode="numeric"
                  value={s.qty}
                  placeholder="qtd"
                  className="px-1"
                  onChange={(e) =>
                    onChange({ sizes: item.sizes!.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className={btnSmall}
              onClick={() => onChange({ sizes: [...item.sizes!, { size: "", qty: "" }] })}
            >
              + tamanho
            </button>
          </div>
          <p className={cx("mt-1 text-xs", sizesSum && sizesSum !== totalPieces ? "text-amber-700" : "text-slate-500")}>
            Soma dos tamanhos: {sizesSum}
            {sizesSum > 0 && sizesSum !== totalPieces && (
              <>
                {" "}
                (diferente do total de {totalPieces}).{" "}
                <button
                  type="button"
                  className="text-blue-600 underline"
                  onClick={() => onChange({ totalPieces: String(sizesSum) })}
                >
                  Usar soma como total
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
