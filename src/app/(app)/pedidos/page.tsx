import Link from "next/link";
import { ORDER_STATUSES, type Currency } from "@/db/schema";
import { Badge, btnPrimary, btnSecondary, Card, EmptyState, Input, PageHeader, Select, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
} from "@/lib/labels";
import { queryOrders } from "@/lib/order-query";
import { loadOptions } from "@/lib/orders";
import { RECEIPT_STATUS_COLOR, RECEIPT_STATUS_LABEL, type ReceiptStatus } from "@/lib/receiving";

export default async function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  await requireUser();
  const sp = await searchParams;
  const [{ f, list }, options] = await Promise.all([queryOrders(sp), loadOptions()]);

  const pendingBy: Record<Currency, number> = { USD: 0, BRL: 0 };
  let pieces = 0;
  let extrasPending = 0;
  let taxAwaiting = 0;
  for (const { t } of list) {
    if (t.taxAwaiting) taxAwaiting++;
    if (t.pending > 0) pendingBy[t.currency] += t.pending;
    pieces += t.pieces;
    extrasPending += t.extrasPendingBRL;
  }
  const hasFilters = Object.values(f).some(Boolean);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pedidos"
        actions={
          <>
            <a
              href={`/pedidos/exportar?${new URLSearchParams(
                Object.entries(f).filter(([, v]) => v) as [string, string][],
              ).toString()}`}
              className={btnSecondary}
            >
              ⬇ Excel
            </a>
            <Link href="/pedidos/novo" className={btnPrimary}>
              + Novo pedido
            </Link>
          </>
        }
      />

      <details className="rounded-xl border border-slate-200 bg-white shadow-sm" open={hasFilters}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
          Filtros {hasFilters && <span className="text-blue-600">(ativos)</span>}
        </summary>
        <form className="grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="q" defaultValue={f.q} placeholder="Buscar título, produto, rastreio..." className="lg:col-span-2" />
          <Select name="fornecedor" defaultValue={f.fornecedor}>
            <option value="">Todos os fornecedores</option>
            {options.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={f.status}>
            <option value="">Todos os status</option>
            <option value="abertos">Em aberto (não recebidos)</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="modalidade" defaultValue={f.modalidade}>
            <option value="">Todas as modalidades</option>
            {options.modes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select name="transportadora" defaultValue={f.transportadora}>
            <option value="">Todas as transportadoras</option>
            {options.carriers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select name="pagamento" defaultValue={f.pagamento}>
            <option value="">Qualquer pagamento</option>
            <option value="em_aberto">Com saldo a pagar</option>
            {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="situacao" defaultValue={f.situacao}>
            <option value="">Qualquer situação</option>
            <option value="atrasados">Atrasados</option>
            <option value="revisao">Precisam de revisão</option>
            <option value="imposto">Imposto por fora a lançar</option>
          </Select>
          <Select name="recebimento" defaultValue={f.recebimento}>
            <option value="">Qualquer recebimento</option>
            {(Object.keys(RECEIPT_STATUS_LABEL) as ReceiptStatus[]).map((s) => (
              <option key={s} value={s}>
                {RECEIPT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <label className="text-xs text-slate-600">
            Pedido de
            <Input type="date" name="de" defaultValue={f.de} />
          </label>
          <label className="text-xs text-slate-600">
            até
            <Input type="date" name="ate" defaultValue={f.ate} />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button className={btnPrimary}>Filtrar</button>
            {hasFilters && (
              <Link href="/pedidos" className={btnSecondary}>
                Limpar
              </Link>
            )}
          </div>
        </form>
      </details>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Pedidos" value={list.length} />
        <Stat label="Peças" value={fmtNumber(pieces, 0)} />
        <Stat
          label="A pagar aos fornecedores"
          value={
            <>
              {fmtMoney(pendingBy.BRL)}
              {pendingBy.USD > 0 && <div>{fmtMoney(pendingBy.USD, "USD")}</div>}
            </>
          }
          tone="red"
        />
        <Stat
          label="Despesas pendentes"
          value={fmtMoney(extrasPending)}
          sub={taxAwaiting ? `${taxAwaiting} pedido(s) com imposto a lançar` : undefined}
          tone="amber"
        />
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState>{hasFilters ? "Nenhum pedido encontrado com esses filtros." : "Nenhum pedido cadastrado ainda."}</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2">
          {list.map(({ o, t, late, r }) => (
            <li key={o.id}>
              <Link
                href={`/pedidos/${o.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">
                      <span className="text-slate-400">#{o.id}</span> {o.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[o.supplier?.name, o.transportMode?.name, `Pedido ${fmtDate(o.orderDate)}`]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      <span className={late ? "font-semibold text-red-600" : undefined}>
                        Previsão {fmtDate(o.expectedDate)}
                        {late && " (atrasado)"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular">{fmtMoney(t.supplierTotal, t.currency)}</div>
                    {t.pending > 0.01 && (
                      <div className="text-xs font-medium text-red-600">Falta {fmtMoney(t.pending, t.currency)}</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  <Badge className={PAYMENT_STATUS_COLOR[t.paymentStatus]}>{PAYMENT_STATUS_LABEL[t.paymentStatus]}</Badge>
                  {r.status !== "nao_recebido" && (
                    <Badge className={RECEIPT_STATUS_COLOR[r.status]}>{RECEIPT_STATUS_LABEL[r.status]}</Badge>
                  )}
                  <Badge className="bg-slate-100 text-slate-700">{fmtNumber(t.pieces, 0)} peças</Badge>
                  {o.trackings.length > 0 && (
                    <Badge className="bg-slate-100 text-slate-700">
                      {o.trackings.filter((x) => x.status === "entregue" || x.received).length}/{o.trackings.length}{" "}
                      rastreios entregues
                    </Badge>
                  )}
                  {t.taxAwaiting && <Badge className="bg-orange-100 text-orange-800">Imposto a lançar</Badge>}
                  {o.needsReview && <Badge className="bg-yellow-100 text-yellow-800">Revisar</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
