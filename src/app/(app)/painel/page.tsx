import { desc } from "drizzle-orm";
import { AppLink as Link } from "@/components/app-link";
import type { ReactNode } from "react";
import { db } from "@/db";
import { orders, type Currency, type OrderStatus } from "@/db/schema";
import { Badge, btnPrimary, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { computeOrderTotals, convert } from "@/lib/finance";
import { addDays, fmtDate, fmtMoney, fmtNumber, todayISO } from "@/lib/format";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/lib/labels";
import { getRateFor } from "@/lib/rates";
import { computeReceipt, RECEIPT_STATUS_LABEL } from "@/lib/receiving";

const CLOSED: OrderStatus[] = ["recebido", "finalizado", "cancelado"];

export default async function DashboardPage() {
  await requireUser();
  const today = todayISO();
  const soon = addDays(today, 15);
  const [rows, rate] = await Promise.all([
    db.query.orders.findMany({
      orderBy: [desc(orders.orderDate), desc(orders.id)],
      with: { supplier: true, items: true, expenses: true, trackings: true, payments: true, taxPayments: true },
    }),
    getRateFor(),
  ]);
  const todayRate = rate?.rate ?? null;

  const all = rows
    .filter((o) => o.status !== "cancelado")
    .map((o) => ({ o, t: computeOrderTotals(o), r: computeReceipt(o.items, o.trackings) }));
  const open = all.filter(({ o }) => !CLOSED.includes(o.status));

  const pendingBy: Record<Currency, number> = { USD: 0, BRL: 0 };
  let extrasPending = 0;
  const bySupplier = new Map<string, { name: string; id: number | null; USD: number; BRL: number }>();
  for (const { o, t } of all) {
    extrasPending += t.extrasPendingBRL;
    if (t.pending <= 0.01) continue;
    pendingBy[t.currency] += t.pending;
    const key = String(o.supplierId ?? "sem");
    const entry = bySupplier.get(key) ?? { name: o.supplier?.name ?? "Sem fornecedor", id: o.supplierId, USD: 0, BRL: 0 };
    entry[t.currency] += t.pending;
    bySupplier.set(key, entry);
  }
  const toBRL = (v: { USD: number; BRL: number }) => v.BRL + (convert(v.USD, "USD", "BRL", todayRate) ?? 0);
  const supplierList = [...bySupplier.values()].sort((a, b) => toBRL(b) - toBRL(a));
  const pendingTotalBRL = toBRL(pendingBy);

  const inTransitPieces = open.reduce((s, { r }) => s + r.missing, 0);
  const late = open.filter(({ o }) => o.expectedDate && o.expectedDate < today);
  const arriving = open
    .filter(({ o }) => o.expectedDate && o.expectedDate >= today && o.expectedDate <= soon)
    .sort((a, b) => (a.o.expectedDate! < b.o.expectedDate! ? -1 : 1));
  const attention = all.filter(({ o, t, r }) => o.needsReview || t.taxAwaiting || r.status === "divergencia");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Painel"
        actions={
          <Link href="/pedidos/novo" className={btnPrimary}>
            + Novo pedido
          </Link>
        }
      />

      {!rate || rate.day !== today ? (
        <Link href="/cotacoes" className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A cotação do dólar de hoje ainda não foi definida
          {rate ? ` (usando a de ${fmtDate(rate.day)})` : ""}. Toque aqui para definir.
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <TileLink href="/pedidos?pagamento=em_aberto">
          <Stat
            label="A pagar aos fornecedores"
            value={fmtMoney(pendingTotalBRL)}
            sub={
              pendingBy.USD > 0
                ? [fmtMoney(pendingBy.USD, "USD"), pendingBy.BRL > 0 ? fmtMoney(pendingBy.BRL) : null]
                    .filter(Boolean)
                    .join(" + ")
                : undefined
            }
            tone={pendingTotalBRL > 0 ? "red" : "green"}
          />
        </TileLink>
        <TileLink href="/pedidos?status=abertos">
          <Stat label="Pedidos em aberto" value={open.length} />
        </TileLink>
        <TileLink href="/pedidos?status=abertos">
          <Stat label="Peças a receber" value={fmtNumber(inTransitPieces, 0)} />
        </TileLink>
        <TileLink href="/pedidos?situacao=atrasados">
          <Stat label="Pedidos atrasados" value={late.length} tone={late.length ? "red" : undefined} />
        </TileLink>
        <TileLink href="/pedidos?situacao=imposto">
          <Stat
            label="Despesas pendentes"
            value={fmtMoney(extrasPending)}
            sub={(() => {
              const n = all.filter((x) => x.t.taxAwaiting).length;
              return n ? `${n} pedido(s) com imposto a lançar` : "Nenhum imposto a lançar";
            })()}
            tone={extrasPending > 0 ? "amber" : undefined}
          />
        </TileLink>
      </div>
      {pendingBy.USD > 0 && (
        <p className="-mt-2 text-xs text-slate-500">
          Valores em dólar convertidos pela cotação de hoje{todayRate ? ` (${fmtMoney(todayRate)})` : " (não definida)"}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Atrasados (${late.length})`}>
          <OrderList
            rows={late}
            empty="Nenhum pedido atrasado."
            right={({ o }) => <span className="text-red-600">Previsto {fmtDate(o.expectedDate)}</span>}
          />
        </Card>

        <Card title={`Chegando nos próximos 15 dias (${arriving.length})`}>
          <OrderList
            rows={arriving}
            empty="Nenhuma chegada prevista nos próximos 15 dias."
            right={({ o }) => <span>{fmtDate(o.expectedDate)}</span>}
          />
        </Card>

        <Card title="A pagar por fornecedor">
          {supplierList.length === 0 ? (
            <EmptyState>Nenhum saldo a pagar.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {supplierList.map((s) => (
                <li key={s.name}>
                  <Link href={s.id ? `/pedidos?fornecedor=${s.id}&pagamento=em_aberto` : "/pedidos?pagamento=em_aberto"}
                    className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-right tabular">
                      {s.USD > 0 && <div>{fmtMoney(s.USD, "USD")}</div>}
                      {s.BRL > 0 && <div>{fmtMoney(s.BRL)}</div>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Precisam de atenção (${attention.length})`}>
          <OrderList
            rows={attention}
            empty="Nada pendente de revisão."
            right={({ o, t, r }) => (
              <span className="flex flex-wrap justify-end gap-1">
                {o.needsReview && <Badge className="bg-yellow-100 text-yellow-800">Revisar</Badge>}
                {t.taxAwaiting && <Badge className="bg-orange-100 text-orange-800">Imposto a lançar</Badge>}
                {r.status === "divergencia" && (
                  <Badge className="bg-red-100 text-red-700">{RECEIPT_STATUS_LABEL.divergencia}</Badge>
                )}
              </span>
            )}
          />
        </Card>
      </div>
    </div>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block h-full rounded-lg bg-white shadow-sm ring-1 ring-slate-200 hover:ring-blue-300 [&>div]:h-full">
      {children}
    </Link>
  );
}

type Row = {
  o: { id: number; title: string; status: OrderStatus; expectedDate: string | null; needsReview: boolean; supplier: { name: string } | null };
  t: ReturnType<typeof computeOrderTotals>;
  r: ReturnType<typeof computeReceipt>;
};

function OrderList({ rows, empty, right }: { rows: Row[]; empty: string; right: (row: Row) => ReactNode }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {rows.slice(0, 12).map((row) => (
        <li key={row.o.id}>
          <Link href={`/pedidos/${row.o.id}`} className="flex items-start justify-between gap-2 py-2 hover:bg-slate-50">
            <span className="min-w-0">
              <span className="block truncate font-medium">
                <span className="text-slate-400">#{row.o.id}</span> {row.o.title}
              </span>
              <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                {row.o.supplier?.name}
                <Badge className={ORDER_STATUS_COLOR[row.o.status]}>{ORDER_STATUS_LABEL[row.o.status]}</Badge>
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">{right(row)}</span>
          </Link>
        </li>
      ))}
      {rows.length > 12 && <li className="py-2 text-center text-xs text-slate-500">e mais {rows.length - 12}…</li>}
    </ul>
  );
}
