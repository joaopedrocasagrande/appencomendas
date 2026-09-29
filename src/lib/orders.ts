import { asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  carriers,
  orderItems,
  orders,
  paymentMethods,
  payments,
  products,
  suppliers,
  transportModes,
} from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NamedTable = PgTable & { id: AnyPgColumn; name: AnyPgColumn };

/**
 * Procura um cadastro pelo nome (sem diferenciar maiúsculas) e cria se não existir.
 * É o que permite "cadastrar na hora" digitando um nome novo no pedido.
 */
export async function resolveByName(
  tx: Tx,
  table: NamedTable,
  name: string | null | undefined,
): Promise<number | null> {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const found = await tx
    .select({ id: table.id })
    .from(table)
    .where(eq(sql`lower(${table.name})`, clean.toLowerCase()))
    .limit(1);
  if (found.length) return found[0].id as number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [created] = await tx.insert(table).values({ name: clean } as any).returning({ id: table.id });
  return created.id as number;
}

export async function loadOrder(id: number) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      supplier: true,
      transportMode: true,
      carrier: true,
      items: { with: { product: true }, orderBy: [asc(orderItems.position), asc(orderItems.id)] },
      expenses: true,
      trackings: { with: { carrier: true } },
      payments: { with: { method: true }, orderBy: [asc(payments.paidOn), asc(payments.id)] },
    },
  });
}

export type FullOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

export async function loadOptions() {
  const [s, p, m, c, pm] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
    db
      .select({ id: transportModes.id, name: transportModes.name, defaultDays: transportModes.defaultDays })
      .from(transportModes)
      .orderBy(asc(transportModes.name)),
    db
      .select({ id: carriers.id, name: carriers.name, trackingUrl: carriers.trackingUrl })
      .from(carriers)
      .orderBy(asc(carriers.name)),
    db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods).orderBy(asc(paymentMethods.name)),
  ]);
  return { suppliers: s, products: p, modes: m, carriers: c, paymentMethods: pm };
}

export type Options = Awaited<ReturnType<typeof loadOptions>>;

export function trackingLink(code: string, carrierUrl?: string | null) {
  const encoded = encodeURIComponent(code.trim());
  if (carrierUrl && carrierUrl.includes("{code}")) return carrierUrl.replace("{code}", encoded);
  return `https://t.17track.net/pt#nums=${encoded}`;
}
