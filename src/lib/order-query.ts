import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ORDER_STATUSES, orders, suppliers, type OrderStatus } from "@/db/schema";
import { computeOrderTotals } from "./finance";
import { todayISO } from "./format";
import type { PaymentStatus } from "./labels";
import { computeReceipt } from "./receiving";

const CLOSED: OrderStatus[] = ["recebido", "finalizado", "cancelado"];

type SearchParams = Record<string, string | string[] | undefined>;

/** Busca os pedidos aplicando os filtros da lista (usado pela lista e pela exportação). */
export async function queryOrders(sp: SearchParams) {
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
    recebimento: get("recebimento"),
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

  const rows = await db.query.orders.findMany({
      where: and(...where),
      orderBy: [desc(orders.orderDate), desc(orders.id)],
      with: {
        supplier: true,
        items: { with: { product: true } },
        transportMode: true,
        expenses: true,
        trackings: { with: { carrier: true } },
        payments: { with: { method: true } },
        taxPayments: { with: { tracking: true } },
        carrier: true,
      },
    });

  let list = rows.map((o) => ({
    o,
    t: computeOrderTotals(o),
    late: !!o.expectedDate && o.expectedDate < today && !CLOSED.includes(o.status),
    r: computeReceipt(o.items, o.trackings),
  }));
  if (f.recebimento) list = list.filter((x) => x.r.status === f.recebimento);
  if (f.pagamento) {
    list = list.filter(({ t }) =>
      f.pagamento === "em_aberto" ? t.pending > 0.01 : t.paymentStatus === (f.pagamento as PaymentStatus),
    );
  }
  if (f.situacao === "atrasados") list = list.filter((x) => x.late);
  if (f.situacao === "imposto") list = list.filter((x) => x.t.taxAwaiting);

  return { f, list };
}

export type OrderRow = Awaited<ReturnType<typeof queryOrders>>["list"][number];
