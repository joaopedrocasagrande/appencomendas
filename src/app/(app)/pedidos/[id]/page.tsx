import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  cx,
  EmptyState,
  PageHeader,
  Select,
  Stat,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { computeReceipt, RECEIPT_STATUS_COLOR, RECEIPT_STATUS_LABEL } from "@/lib/receiving";
import { ORDER_STATUSES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { computeOrderTotals, convert, otherCurrency } from "@/lib/finance";
import { fmtDate, fmtMoney, fmtNumber, toInput, todayISO } from "@/lib/format";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  TAX_MODE_HINT,
  TAX_MODE_LABEL,
} from "@/lib/labels";
import { loadOptions, loadOrder, trackingLink } from "@/lib/orders";
import { getRateFor } from "@/lib/rates";
import {
  deleteOrder,
  deletePayment,
  markReviewed,
  toggleExpensePaid,
  deleteTaxPayment,
  updateOrderStatus,
} from "../actions";
import { PaymentForm } from "./payment-form";
import { TaxPaymentForm } from "./tax-payment-form";
import { TrackingsPanel, type TrackingView } from "./trackings-panel";

const CLOSED = ["recebido", "finalizado", "cancelado"];

export default async function OrderPage({ params }: PageProps<"/pedidos/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [order, options, todayRate] = await Promise.all([loadOrder(id), loadOptions(), getRateFor()]);
  if (!order) notFound();

  const today = todayISO();
  const t = computeOrderTotals(order);
  const r = computeReceipt(order.items, order.trackings);
  const cur = order.currency;
  const other = (v: number) => {
    const o = otherCurrency(v, cur, t.orderRate);
    return o ? `≈ ${fmtMoney(o.value, o.currency)}` : undefined;
  };
  const late = !!order.expectedDate && order.expectedDate < today && !CLOSED.includes(order.status);
  const isAdmin = user.role === "admin";

  const trackingViews: TrackingView[] = order.trackings
    .sort((a, b) => a.id - b.id)
    .map((tr) => ({
      id: tr.id,
      code: tr.code,
      label: tr.label,
      carrierName: tr.carrier?.name ?? "",
      status: tr.status,
      taxBRL: order.taxPayments
        .filter((tp) => tp.trackingId === tr.id)
        .reduce(
          (s, tp) =>
            s + (convert(Number(tp.amount), tp.currency, "BRL", Number(tp.exchangeRate) || t.orderRate) ?? 0),
          0,
        ),
      received: tr.received,
      receivedDate: tr.receivedDate,
      notes: tr.notes,
      link: trackingLink(tr.code, tr.carrier?.trackingUrl),
    }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            <span className="text-slate-400">#{order.id}</span> {order.title}
          </>
        }
        back="/pedidos"
        actions={
          <>
            <Link prefetch={false} href={`/pedidos/${order.id}/editar`} className={btnPrimary}>
              Editar pedido
            </Link>
            {isAdmin && (
              <form action={deleteOrder}>
                <input type="hidden" name="id" value={order.id} />
                <ConfirmButton className={btnDanger} message="Excluir este pedido com todos os itens, pagamentos e rastreios?" />
              </form>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge className={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
        <Badge className={PAYMENT_STATUS_COLOR[t.paymentStatus]}>{PAYMENT_STATUS_LABEL[t.paymentStatus]}</Badge>
        <Badge className={RECEIPT_STATUS_COLOR[r.status]}>{RECEIPT_STATUS_LABEL[r.status]}</Badge>
        {late && <Badge className="bg-red-100 text-red-700">Atrasado</Badge>}
        {order.needsReview && <Badge className="bg-yellow-100 text-yellow-800">Precisa de revisão</Badge>}
      </div>

      {order.needsReview && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          <span>Este pedido foi marcado para revisão. Confira os dados e desmarque quando estiver certo.</span>
          <form action={markReviewed}>
            <input type="hidden" name="id" value={order.id} />
            <SubmitButton className={btnSmall}>Marcar como revisado</SubmitButton>
          </form>
        </div>
      )}
      {t.missingRate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Há valores em outra moeda sem cotação definida. Edite o pedido e informe a cotação para os totais ficarem
          corretos.
        </div>
      )}

      <Card title="Resumo">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Fornecedor" value={order.supplier?.name} />
          <Info label="Data do pedido" value={fmtDate(order.orderDate)} />
          <Info label="Previsão" value={fmtDate(order.expectedDate)} tone={late ? "red" : undefined} />
          <Info label="Modalidade" value={order.transportMode?.name} />
          <Info label="Transportadora" value={order.carrier?.name} />
          <Info label="Moeda" value={cur === "USD" ? "Dólar ($)" : "Real (R$)"} />
          <Info label="Cotação do pedido" value={t.orderRate ? fmtMoney(t.orderRate) : "—"} />
          <Info label="Total de peças" value={fmtNumber(t.pieces, 0)} />
        </dl>
        <form action={updateOrderStatus} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={order.id} />
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Status do pedido</span>
            <Select name="status" defaultValue={order.status} className="w-auto">
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </label>
          <SubmitButton className={btnSecondary} pendingText="Atualizando...">
            Atualizar status
          </SubmitButton>
        </form>
        {order.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{order.notes}</p>}
      </Card>

      <Card title="Financeiro">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Total ao fornecedor" value={fmtMoney(t.supplierTotal, cur)} sub={other(t.supplierTotal)} />
          <Stat label="Já pago" value={fmtMoney(t.paid, cur)} sub={`${fmtMoney(t.paidBRL)} efetivos`} tone="green" />
          <Stat
            label="Falta pagar"
            value={fmtMoney(Math.max(t.pending, 0), cur)}
            sub={t.pending < 0 ? `Pago a mais: ${fmtMoney(-t.pending, cur)}` : other(Math.max(t.pending, 0))}
            tone={t.pending > 0.01 ? "red" : "green"}
          />
          <Stat
            label="Imposto e despesas à parte"
            value={fmtMoney(t.extrasBRL)}
            sub={
              t.extrasPendingBRL > 0
                ? `Despesas pendentes: ${fmtMoney(t.extrasPendingBRL)}`
                : t.taxAwaiting
                  ? "Imposto por fora ainda não lançado"
                  : "Nada pendente"
            }
            tone={t.extrasPendingBRL > 0 || t.taxAwaiting ? "amber" : undefined}
          />
          <Stat
            label="Imposto"
            value={order.taxMode === "sem" && t.taxTotalBRL === 0 ? "Sem imposto" : fmtMoney(t.taxTotalBRL)}
            sub={TAX_MODE_LABEL[order.taxMode]}
          />
          <Stat label="Custo total estimado" value={fmtMoney(t.landedBRL)} sub="Pagamentos + saldo + custos à parte" />
          <Stat
            label="Custo real por peça"
            value={t.costPerPieceBRL !== null ? fmtMoney(t.costPerPieceBRL) : "—"}
            sub="Inclui frete, imposto e despesas"
          />
        </div>

        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-slate-100 tabular">
            <Row label="Produtos" value={fmtMoney(t.itemsTotal, cur)} />
            <Row label="Frete" value={fmtMoney(t.freight, cur)} />
            <Row label="Desconto" value={`− ${fmtMoney(t.discount, cur)}`} />
            {t.supplierExpenses > 0 && (
              <Row label="Despesas cobradas pelo fornecedor" value={fmtMoney(t.supplierExpenses, cur)} />
            )}
            <Row label="Total ao fornecedor" value={fmtMoney(t.supplierTotal, cur)} bold />
          </tbody>
        </table>

        {order.expenses.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Outras despesas</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {order.expenses.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {e.description}{" "}
                    <span className="text-xs text-slate-500">
                      {e.chargedBySupplier ? "(cobrada pelo fornecedor)" : e.paid ? "(paga)" : "(pendente)"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <strong className="tabular">{fmtMoney(Number(e.amount), e.currency)}</strong>
                    {!e.chargedBySupplier && (
                      <form action={toggleExpensePaid}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="paid" value={String(!e.paid)} />
                        <SubmitButton className={btnSmall}>{e.paid ? "Desmarcar pago" : "Marcar pago"}</SubmitButton>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={`Pagamentos ao fornecedor (${order.payments.length})`}>
        {order.payments.length === 0 ? (
          <EmptyState>Nenhum pagamento lançado.</EmptyState>
        ) : (
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {order.payments.map((p) => {
              const inOrder = convert(Number(p.amount), p.currency, cur, Number(p.exchangeRate) || t.orderRate);
              return (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div>
                    <div className="font-medium">
                      {fmtDate(p.paidOn)} · {fmtMoney(Number(p.amount), p.currency)}
                      {p.currency !== cur && inOrder !== null && (
                        <span className="text-slate-500"> ({fmtMoney(inOrder, cur)})</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[
                        p.method?.name,
                        p.exchangeRate ? `cotação ${fmtMoney(Number(p.exchangeRate))}` : null,
                        p.notes,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {isAdmin && (
                    <form action={deletePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <ConfirmButton className={`${btnSmall} text-red-600`} message="Excluir este pagamento?" />
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="rounded-lg bg-slate-50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Lançar pagamento</h3>
          <PaymentForm
            orderId={order.id}
            orderCurrency={cur}
            today={today}
            todayRate={todayRate ? toInput(todayRate.rate) : toInput(order.exchangeRate)}
            methods={options.paymentMethods.map((m) => m.name)}
            suggestedAmount={t.pending > 0 ? toInput(t.pending) : ""}
          />
        </div>
      </Card>

      <Card title="Imposto">
        <p className="text-sm">
          <strong>{TAX_MODE_LABEL[order.taxMode]}</strong>
          <span className="text-slate-500"> — {TAX_MODE_HINT[order.taxMode]}</span>
        </p>
        {order.taxMode === "incluso" && Number(order.taxAmount) > 0 && (
          <p className="mt-2 text-sm">
            Valor incluso: <strong>{fmtMoney(Number(order.taxAmount), cur)}</strong>{" "}
            <span className="text-slate-500">{other(Number(order.taxAmount))}</span>
          </p>
        )}
        {t.taxAwaiting && (
          <p className="mt-2 rounded-md bg-orange-50 p-2 text-sm text-orange-800">
            Imposto por fora ainda não lançado. Quando pagar, lance abaixo.
          </p>
        )}
        {order.taxMode !== "incluso" && (
          <>
            {order.taxPayments.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {order.taxPayments.map((tp) => (
                  <li key={tp.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">
                        {fmtDate(tp.paidOn)} · {fmtMoney(Number(tp.amount), tp.currency)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[
                          tp.tracking ? `Pacote ${tp.tracking.code}` : "Pedido todo",
                          tp.exchangeRate && tp.currency === "USD" ? `cotação ${fmtMoney(Number(tp.exchangeRate))}` : null,
                          tp.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {isAdmin && (
                      <form action={deleteTaxPayment}>
                        <input type="hidden" name="id" value={tp.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <ConfirmButton className={`${btnSmall} text-red-600`} message="Excluir este lançamento de imposto?" />
                      </form>
                    )}
                  </li>
                ))}
                <li className="flex justify-between py-2 font-semibold">
                  <span>Total de imposto pago</span>
                  <span>{fmtMoney(t.taxPaidBRL)}</span>
                </li>
              </ul>
            )}
            <details className="mt-3 rounded-lg bg-slate-50 p-3" open={t.taxAwaiting}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Lançar imposto pago</summary>
              <div className="mt-3">
                <TaxPaymentForm
                  orderId={order.id}
                  today={today}
                  todayRate={todayRate ? toInput(todayRate.rate) : toInput(order.exchangeRate)}
                  trackings={order.trackings.map((tr) => ({ id: tr.id, code: tr.code, label: tr.label }))}
                />
              </div>
            </details>
          </>
        )}
      </Card>

      <Card
        title={`Itens (${order.items.length})`}
        actions={
          <Link prefetch={false} href={`/pedidos/${order.id}/editar`} className={btnSmall}>
            Editar itens
          </Link>
        }
      >
        {order.items.length === 0 ? (
          <EmptyState>Nenhum item.</EmptyState>
        ) : (
          <>
          <ul className="divide-y divide-slate-100 text-sm sm:hidden">
            {order.items.map((i) => (
              <li key={i.id} className="py-2">
                <div className="font-medium">{i.product.name}</div>
                <div className="text-xs text-slate-500">
                  {[
                    i.variant,
                    i.boxes ? `${fmtNumber(Number(i.boxes))} caixa(s)` : null,
                    i.grids ? `${fmtNumber(Number(i.grids))} grade(s)` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {i.sizes && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(i.sizes).map(([s, q]) => (
                      <Badge key={s} className="bg-slate-100 text-slate-700">
                        {s}: {q}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex justify-between tabular">
                  <span>
                    {fmtNumber(i.totalPieces, 0)} pç × {fmtMoney(Number(i.unitPrice), cur)}
                    {i.receivedQty !== null && (
                      <span className={i.receivedQty === i.totalPieces ? " text-green-700" : " text-amber-700"}>
                        {" "}
                        · receb. {i.receivedQty}
                      </span>
                    )}
                  </span>
                  <strong>{fmtMoney(i.totalPieces * Number(i.unitPrice), cur)}</strong>
                </div>
              </li>
            ))}
            <li className="flex justify-between py-2 font-semibold tabular">
              <span>{fmtNumber(t.pieces, 0)} peças</span>
              <span>{fmtMoney(t.itemsTotal, cur)}</span>
            </li>
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Produto</th>
                  <th className="px-2 text-right">Caixas</th>
                  <th className="px-2 text-right">Grades</th>
                  <th className="px-2 text-right">Peças</th>
                  <th className="px-2 text-right">Receb.</th>
                  <th className="px-2 text-right">Unit.</th>
                  <th className="pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular">
                {order.items.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{i.product.name}</div>
                      <div className="text-xs text-slate-500">
                        {[
                          i.variant,
                          i.piecesPerBox ? `${fmtNumber(Number(i.piecesPerBox))}/caixa` : null,
                          i.piecesPerGrid && i.grids ? `${fmtNumber(Number(i.piecesPerGrid))}/grade` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {i.sizes && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(i.sizes).map(([s, q]) => (
                            <Badge key={s} className="bg-slate-100 text-slate-700">
                              {s}: {q}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 text-right">{i.boxes ? fmtNumber(Number(i.boxes)) : "—"}</td>
                    <td className="px-2 text-right">{i.grids ? fmtNumber(Number(i.grids)) : "—"}</td>
                    <td className="px-2 text-right font-medium">{fmtNumber(i.totalPieces, 0)}</td>
                    <td
                      className={cx(
                        "px-2 text-right",
                        i.receivedQty === null
                          ? "text-slate-400"
                          : i.receivedQty === i.totalPieces && !i.defectiveQty
                            ? "text-green-700"
                            : "text-amber-700",
                      )}
                    >
                      {i.receivedQty === null ? "—" : fmtNumber(i.receivedQty, 0)}
                      {i.defectiveQty ? <div className="text-xs text-red-600">{i.defectiveQty} def.</div> : null}
                    </td>
                    <td className="px-2 text-right">{fmtMoney(Number(i.unitPrice), cur)}</td>
                    <td className="pl-2 text-right font-medium">
                      {fmtMoney(i.totalPieces * Number(i.unitPrice), cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 font-semibold tabular">
                <tr>
                  <td className="py-2">Total</td>
                  <td />
                  <td />
                  <td className="px-2 text-right">{fmtNumber(t.pieces, 0)}</td>
                  <td className="px-2 text-right">{r.received ? fmtNumber(r.received, 0) : "—"}</td>
                  <td />
                  <td className="pl-2 text-right">{fmtMoney(t.itemsTotal, cur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </Card>

      <Card
        title="Recebimento"
        actions={
          <Link prefetch={false} href={`/pedidos/${order.id}/conferencia`} className={btnPrimary}>
            Conferir recebimento
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Stat label="Situação" value={RECEIPT_STATUS_LABEL[r.status]} />
          <Stat label="Peças esperadas" value={fmtNumber(r.expected, 0)} />
          <Stat
            label="Peças recebidas"
            value={fmtNumber(r.received, 0)}
            tone={r.received === 0 ? undefined : r.received < r.expected ? "amber" : "green"}
          />
          <Stat label="Faltando" value={fmtNumber(r.missing, 0)} tone={r.missing > 0 && r.received > 0 ? "amber" : undefined} />
          <Stat label="Com defeito" value={fmtNumber(r.defective, 0)} tone={r.defective > 0 ? "red" : undefined} />
        </div>
        {r.packagesTotal > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Pacotes recebidos: {r.packagesReceived} de {r.packagesTotal}
          </p>
        )}
        {order.items.some((i) => i.checkNotes) && (
          <ul className="mt-2 space-y-1 text-sm">
            {order.items
              .filter((i) => i.checkNotes)
              .map((i) => (
                <li key={i.id} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                  <strong>{i.product.name}:</strong> {i.checkNotes}
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card title={`Rastreios (${order.trackings.length})`}>
        <TrackingsPanel
          orderId={order.id}
          trackings={trackingViews}
          carriers={options.carriers.map((c) => c.name)}
          defaultCarrier={order.carrier?.name ?? ""}
          today={today}
        />
      </Card>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value?: string | null; tone?: "red" }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={tone === "red" ? "font-medium text-red-600" : "font-medium text-slate-900"}>{value || "—"}</dd>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : undefined}>
      <td className="py-1.5 text-slate-600">{label}</td>
      <td className="py-1.5 text-right">{value}</td>
    </tr>
  );
}
