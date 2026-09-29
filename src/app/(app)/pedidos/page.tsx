import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { ORDER_STATUSES, orders, suppliers, type Currency, type OrderStatus } from "@/db/schema";
import { Badge, btnPrimary, btnSecondary, Card, EmptyState, Input, PageHeader, Select, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { computeOrderTotals } from "@/lib/finance";
import { fmtDate, fmtMoney, fmtNumber, todayISO } from "@/lib/format";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  type PaymentStatus,
} from "@/lib/labels";
import { loadOptions } from "@/lib/orders";

const CLOSED: OrderStatus[] = ["recebido", "finalizado", "cancelado"];

export default async function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  await requireUser();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = {
    q: get("q"),
    fornecedor: get("fornecedor"),
    modalidade: get("modalidade"),
    transportadora: get("transportadora"),
    status: get("status"),
    pagamento: get("pagamento"),
    de: get("de"),
    ate: get("ate"),
    situacao: get("situacao"),
  };
  const today = todayISO();

  const where: (SQL | undefined)[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(
      or(
        ilike(orders.title, like),
        ilike(orders.notes, like),
        sql`exists (select 1 from ${suppliers} s where s.id = ${orders.supplierId} and s.name ilike ${like})`,
        sql`exists (select 1 from trackings t where t.order_id = ${orders.id} and t.code ilike ${like})`,
        sql`exists (select 1 from order_items i join products p on p.id = i.product_id where i.order_id = ${orders.id} and p.name ilike ${like})`,
      ),
    );
  }
  if (f.fornecedor) where.push(eq(orders.supplierId, Number(f.fornecedor)));
  if (f.modalidade) where.push(eq(orders.transportModeId, Number(f.modalidade)));
  if (f.transportadora) where.push(eq(orders.carrierId, Number(f.transportadora)));
  if (f.status === "abertos") where.push(sql`${orders.status} not in ('recebido','finalizado','cancelado')`);
  else if (ORDER_STATUSES.includes(f.status as OrderStatus)) where.push(eq(orders.status, f.status as OrderStatus));
  if (f.de) where.push(gte(orders.orderDate, f.de));
  if (f.ate) where.push(lte(orders.orderDate, f.ate));
  if (f.situacao === "revisao") where.push(eq(orders.needsReview, true));

  const [rows, options] = await Promise.all([
    db.query.orders.findMany({
      where: and(...where),
      orderBy: [desc(orders.orderDate), desc(orders.id)],
      with: {
        supplier: true,
        transportMode: true,
        items: true,
        expenses: true,
        trackings: true,
        payments: true,
        taxPayments: true,
      },
    }),
    loadOptions(),
  ]);

  let list = rows.map((o) => ({
    o,
    t: computeOrderTotals(o),
    late: !!o.expectedDate && o.expectedDate < today && !CLOSED.includes(o.status),
  }));
  if (f.pagamento) {
    list = list.filter(({ t }) =>
      f.pagamento === "em_aberto" ? t.pending > 0.01 : t.paymentStatus === (f.pagamento as PaymentStatus),
    );
  }
  if (f.situacao === "atrasados") list = list.filter((x) => x.late);
  if (f.situacao === "imposto") list = list.filter((x) => x.t.taxAwaiting);

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
          <Link href="/pedidos/novo" className={btnPrimary}>
            + Novo pedido
          </Link>
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
          {list.map(({ o, t, late }) => (
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
