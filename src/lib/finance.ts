import type { Currency } from "@/db/schema";
import type { PaymentStatus } from "./labels";

type Num = string | number | null | undefined;

const n = (v: Num) => {
  if (v === null || v === undefined || v === "") return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const rateOf = (v: Num) => {
  const x = n(v);
  return x > 0 ? x : null;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Converte um valor entre USD e BRL usando a cotação (R$ por US$ 1). */
export function convert(amount: number, from: Currency, to: Currency, rate: number | null) {
  if (from === to) return amount;
  if (!rate) return null;
  return from === "USD" ? amount * rate : amount / rate;
}

export type OrderForTotals = {
  currency: Currency;
  exchangeRate: Num;
  freight: Num;
  discount: Num;
  hasTax: boolean;
  taxIncluded: boolean;
  taxAmount: Num;
  taxPaid: boolean;
  items: { totalPieces: number; unitPrice: Num }[];
  expenses: { amount: Num; currency: Currency; chargedBySupplier: boolean; paid: boolean }[];
  trackings: { taxAmount: Num; taxCurrency: Currency; taxPaid: boolean }[];
  payments: { amount: Num; currency: Currency; exchangeRate: Num }[];
};

export type OrderTotals = ReturnType<typeof computeOrderTotals>;

/**
 * Regras:
 * - Total a pagar ao fornecedor = produtos + frete − desconto + despesas cobradas pelo fornecedor.
 * - Imposto "incluso no pedido" já está dentro do valor (é apenas informativo).
 * - Imposto não incluso, impostos por rastreio e despesas não cobradas pelo fornecedor
 *   são custos à parte, com controle próprio de pago/pendente.
 * - Pagamentos são convertidos para a moeda do pedido pela cotação do próprio pagamento.
 */
export function computeOrderTotals(o: OrderForTotals) {
  const cur = o.currency;
  const orderRate = rateOf(o.exchangeRate);
  let missingRate = false;

  const toOrder = (amount: number, from: Currency, rate: number | null = orderRate) => {
    const v = convert(amount, from, cur, rate ?? orderRate);
    if (v === null) {
      missingRate = true;
      return 0;
    }
    return v;
  };
  const toBRL = (amount: number, from: Currency, rate: number | null = orderRate) => {
    const v = convert(amount, from, "BRL", rate ?? orderRate);
    if (v === null) {
      missingRate = true;
      return 0;
    }
    return v;
  };

  const pieces = o.items.reduce((s, i) => s + n(i.totalPieces), 0);
  const itemsTotal = o.items.reduce((s, i) => s + n(i.totalPieces) * n(i.unitPrice), 0);
  const freight = n(o.freight);
  const discount = n(o.discount);

  const supplierExpenses = o.expenses
    .filter((e) => e.chargedBySupplier)
    .reduce((s, e) => s + toOrder(n(e.amount), e.currency), 0);

  const supplierTotal = round2(itemsTotal + freight - discount + supplierExpenses);

  const paid = round2(
    o.payments.reduce((s, p) => s + toOrder(n(p.amount), p.currency, rateOf(p.exchangeRate)), 0),
  );
  const pending = round2(supplierTotal - paid);

  let paymentStatus: PaymentStatus;
  if (supplierTotal <= 0 && paid <= 0) paymentStatus = "pendente";
  else if (pending < -0.01) paymentStatus = "pago_a_mais";
  else if (pending <= 0.01) paymentStatus = "pago";
  else if (paid > 0) paymentStatus = "parcial";
  else paymentStatus = "pendente";

  // Custos à parte (em R$)
  const orderTaxSeparate = o.hasTax && !o.taxIncluded ? n(o.taxAmount) : 0;
  const orderTaxBRL = toBRL(orderTaxSeparate, cur);
  const trackingTaxBRL = o.trackings.reduce((s, t) => s + toBRL(n(t.taxAmount), t.taxCurrency), 0);
  const otherExpensesBRL = o.expenses
    .filter((e) => !e.chargedBySupplier)
    .reduce((s, e) => s + toBRL(n(e.amount), e.currency), 0);
  const extrasBRL = round2(orderTaxBRL + trackingTaxBRL + otherExpensesBRL);
  const extrasPendingBRL = round2(
    (o.taxPaid ? 0 : orderTaxBRL) +
      o.trackings.filter((t) => !t.taxPaid).reduce((s, t) => s + toBRL(n(t.taxAmount), t.taxCurrency), 0) +
      o.expenses
        .filter((e) => !e.chargedBySupplier && !e.paid)
        .reduce((s, e) => s + toBRL(n(e.amount), e.currency), 0),
  );

  const taxTotalBRL = round2(
    toBRL(o.hasTax ? n(o.taxAmount) : 0, cur) + trackingTaxBRL,
  );

  // Custo real em R$: pagamentos já feitos (na cotação de cada um) + saldo pela cotação do pedido + custos à parte
  const paidBRL = o.payments.reduce(
    (s, p) => s + toBRL(n(p.amount), p.currency, rateOf(p.exchangeRate)),
    0,
  );
  const pendingBRL = toBRL(Math.max(pending, 0), cur);
  const landedBRL = round2(paidBRL + pendingBRL + extrasBRL);
  const costPerPieceBRL = pieces > 0 ? landedBRL / pieces : null;

  return {
    currency: cur,
    orderRate,
    pieces,
    itemsTotal: round2(itemsTotal),
    freight,
    discount,
    supplierExpenses: round2(supplierExpenses),
    supplierTotal,
    paid,
    paidBRL: round2(paidBRL),
    pending,
    pendingBRL: round2(pendingBRL),
    paymentStatus,
    orderTaxSeparate,
    extrasBRL,
    extrasPendingBRL,
    taxTotalBRL,
    landedBRL,
    costPerPieceBRL,
    missingRate,
  };
}

/** Valor de uma moeda na outra, para exibir "≈" ao lado. */
export function otherCurrency(amount: number, cur: Currency, rate: number | null) {
  const other: Currency = cur === "USD" ? "BRL" : "USD";
  const v = convert(amount, cur, other, rate);
  return v === null ? null : { value: v, currency: other };
}
