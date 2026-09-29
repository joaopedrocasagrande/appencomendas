"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  carriers,
  CURRENCIES,
  orderExpenses,
  orderItems,
  orders,
  ORDER_STATUSES,
  paymentMethods,
  payments,
  products,
  suppliers,
  taxPayments,
  trackings,
  TRACKING_STATUSES,
  transportModes,
  type Currency,
  type OrderStatus,
  type SizeBreakdown,
  type TrackingStatus,
} from "@/db/schema";
import { assertAdmin, assertUser } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { nameKey, resolveByName, resolveManyByName } from "@/lib/orders";
import { orderSchema, type OrderInput } from "./types";

export type ActionResult = { error?: string; ok?: boolean } | undefined;

const dec = (v: string | undefined, fallback: string | null = null) => {
  const n = parseDecimal(v);
  return n === null ? fallback : String(n);
};
const dateOrNull = (v: string | undefined) => (v ? v : null);

function revalidateOrder(id: number) {
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

// ---------------- Pedido ----------------

export async function saveOrder(raw: OrderInput): Promise<{ error?: string; id?: number }> {
  const user = await assertUser();
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;

  const rate = parseDecimal(input.exchangeRate);
  if (rate !== null && rate <= 0) return { error: "A cotação precisa ser maior que zero." };
  const needsRate =
    input.currency === "USD" || input.expenses.some((e) => e.currency !== input.currency);
  if (needsRate && !rate) {
    return { error: "Informe a cotação do dólar do pedido (necessária para converter os valores)." };
  }

  const orderId = await db.transaction(async (tx) => {
    // Consultas independentes vão em paralelo para reduzir idas ao banco.
    const [supplierId, transportModeId, carrierId, productIds] = await Promise.all([
      resolveByName(tx, suppliers, input.supplierName),
      resolveByName(tx, transportModes, input.transportModeName),
      resolveByName(tx, carriers, input.carrierName),
      resolveManyByName(
        tx,
        products,
        input.items.map((i) => i.productName),
      ),
    ]);

    const values = {
      title: input.title,
      supplierId,
      orderDate: dateOrNull(input.orderDate),
      expectedDate: dateOrNull(input.expectedDate),
      transportModeId,
      carrierId,
      currency: input.currency,
      exchangeRate: rate ? String(rate) : null,
      freight: dec(input.freight, "0")!,
      discount: dec(input.discount, "0")!,
      taxMode: input.taxMode,
      taxAmount: input.taxMode === "incluso" ? dec(input.taxAmount, "0")! : "0",
      status: input.status,
      notes: input.notes.trim() || null,
      needsReview: input.needsReview,
      updatedAt: new Date(),
    };

    let id: number;
    if (input.id) {
      const [updated] = await tx.update(orders).set(values).where(eq(orders.id, input.id)).returning({ id: orders.id });
      if (!updated) throw new Error("Pedido não encontrado.");
      id = updated.id;
    } else {
      const [created] = await tx
        .insert(orders)
        .values({ ...values, createdById: user.id })
        .returning({ id: orders.id });
      id = created.id;
    }

    // Itens: atualiza os existentes (preservando a conferência), cria os novos e remove os retirados.
    const itemRows = input.items.map((item, position) => {
      let sizes: SizeBreakdown | null = null;
      if (item.sizes && item.sizes.length) {
        sizes = {};
        for (const s of item.sizes) {
          const q = parseDecimal(s.qty);
          if (s.size && q) sizes[s.size] = (sizes[s.size] ?? 0) + Math.round(q);
        }
        if (!Object.keys(sizes).length) sizes = null;
      }
      return {
        id: item.id,
        row: {
          orderId: id,
          productId: productIds.get(nameKey(item.productName))!,
          variant: item.variant.trim() || null,
          boxes: dec(item.boxes),
          piecesPerBox: dec(item.piecesPerBox),
          grids: dec(item.grids),
          piecesPerGrid: dec(item.piecesPerGrid),
          totalPieces: Math.round(parseDecimal(item.totalPieces) ?? 0),
          unitPrice: dec(item.unitPrice, "0")!,
          sizes,
          position,
        },
      };
    });
    const keepItemIds = itemRows.map((i) => i.id).filter((x): x is number => !!x);
    const newItems = itemRows.filter((i) => !i.id).map((i) => i.row);

    const expenseRows = input.expenses.map((e) => ({
      id: e.id,
      row: {
        orderId: id,
        description: e.description,
        amount: dec(e.amount, "0")!,
        currency: e.currency,
        chargedBySupplier: e.chargedBySupplier,
        paid: e.chargedBySupplier ? false : e.paid,
      },
    }));
    const keepExpenseIds = expenseRows.map((e) => e.id).filter((x): x is number => !!x);
    const newExpenses = expenseRows.filter((e) => !e.id).map((e) => e.row);

    await Promise.all([
      tx
        .delete(orderItems)
        .where(
          keepItemIds.length
            ? and(eq(orderItems.orderId, id), notInArray(orderItems.id, keepItemIds))
            : eq(orderItems.orderId, id),
        ),
      tx
        .delete(orderExpenses)
        .where(
          keepExpenseIds.length
            ? and(eq(orderExpenses.orderId, id), notInArray(orderExpenses.id, keepExpenseIds))
            : eq(orderExpenses.orderId, id),
        ),
    ]);
    await Promise.all([
      ...itemRows
        .filter((i) => i.id)
        .map((i) =>
          tx
            .update(orderItems)
            .set(i.row)
            .where(and(eq(orderItems.id, i.id!), eq(orderItems.orderId, id))),
        ),
      newItems.length ? tx.insert(orderItems).values(newItems) : null,
      ...expenseRows
        .filter((e) => e.id)
        .map((e) =>
          tx
            .update(orderExpenses)
            .set(e.row)
            .where(and(eq(orderExpenses.id, e.id!), eq(orderExpenses.orderId, id))),
        ),
      newExpenses.length ? tx.insert(orderExpenses).values(newExpenses) : null,
    ]);
    return id;
  });

  revalidateOrder(orderId);
  return { id: orderId };
}

export async function deleteOrder(formData: FormData) {
  await assertAdmin();
  const id = Number(formData.get("id"));
  await db.delete(orders).where(eq(orders.id, id));
  revalidatePath("/pedidos");
  redirect("/pedidos");
}

export async function updateOrderStatus(formData: FormData) {
  await assertUser();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return;
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
  revalidateOrder(id);
}

export async function markReviewed(formData: FormData) {
  await assertUser();
  const id = Number(formData.get("id"));
  await db.update(orders).set({ needsReview: false }).where(eq(orders.id, id));
  revalidateOrder(id);
}

// ---------------- Impostos pagos por fora ----------------

export async function addTaxPayment(orderId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await assertUser();
  const paidOn = String(formData.get("paidOn") ?? "");
  const amount = parseDecimal(formData.get("amount"));
  const currency = String(formData.get("currency")) as Currency;
  const rate = parseDecimal(formData.get("exchangeRate"));
  const trackingId = Number(formData.get("trackingId") || 0) || null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Informe a data do pagamento do imposto." };
  if (!amount || amount <= 0) return { error: "Informe o valor do imposto pago." };
  if (!CURRENCIES.includes(currency)) return { error: "Moeda inválida." };
  if (currency === "USD" && !rate) return { error: "Informe a cotação para converter o imposto em reais." };

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { id: true } });
  if (!order) return { error: "Pedido não encontrado." };
  if (trackingId) {
    const tr = await db.query.trackings.findFirst({
      where: and(eq(trackings.id, trackingId), eq(trackings.orderId, orderId)),
      columns: { id: true },
    });
    if (!tr) return { error: "Rastreio inválido." };
  }

  await db.transaction(async (tx) => {
    await tx.insert(taxPayments).values({
      orderId,
      trackingId,
      paidOn,
      amount: String(amount),
      currency,
      exchangeRate: rate ? String(rate) : null,
      notes: notes || null,
      createdById: user.id,
    });
    // Lançar imposto num pedido marcado "sem imposto" passa a tratá-lo como "por fora".
    await tx
      .update(orders)
      .set({ taxMode: "por_fora", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.taxMode, "sem")));
  });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function deleteTaxPayment(formData: FormData) {
  await assertAdmin();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("orderId"));
  await db.delete(taxPayments).where(and(eq(taxPayments.id, id), eq(taxPayments.orderId, orderId)));
  revalidateOrder(orderId);
}

export async function toggleExpensePaid(formData: FormData) {
  await assertUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("orderId"));
  await db
    .update(orderExpenses)
    .set({ paid: formData.get("paid") === "true" })
    .where(and(eq(orderExpenses.id, id), eq(orderExpenses.orderId, orderId)));
  revalidateOrder(orderId);
}

// ---------------- Pagamentos ----------------

export async function addPayment(orderId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await assertUser();
  const paidOn = String(formData.get("paidOn") ?? "");
  const amount = parseDecimal(formData.get("amount"));
  const currency = String(formData.get("currency")) as Currency;
  const rate = parseDecimal(formData.get("exchangeRate"));
  const methodName = String(formData.get("method") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Informe a data do pagamento." };
  if (!amount || amount <= 0) return { error: "Informe o valor pago." };
  if (!CURRENCIES.includes(currency)) return { error: "Moeda inválida." };

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { currency: true } });
  if (!order) return { error: "Pedido não encontrado." };
  if (currency !== order.currency && !rate) {
    return { error: "Informe a cotação usada neste pagamento para converter a moeda." };
  }

  await db.transaction(async (tx) => {
    const paymentMethodId = await resolveByName(tx, paymentMethods, methodName);
    await tx.insert(payments).values({
      orderId,
      paidOn,
      amount: String(amount),
      currency,
      exchangeRate: rate ? String(rate) : null,
      paymentMethodId,
      notes: notes || null,
      createdById: user.id,
    });
  });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function deletePayment(formData: FormData) {
  await assertAdmin();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("orderId"));
  await db.delete(payments).where(and(eq(payments.id, id), eq(payments.orderId, orderId)));
  revalidateOrder(orderId);
}

// ---------------- Rastreios ----------------

export async function addTrackings(orderId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await assertUser();
  // Aceita vários códigos separados por linha, vírgula, ponto e vírgula ou espaço
  const codes = Array.from(
    new Set(
      String(formData.get("codes") ?? "")
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  if (!codes.length) return { error: "Informe pelo menos um código de rastreio." };
  const label = String(formData.get("label") ?? "").trim() || null;
  const carrierName = String(formData.get("carrier") ?? "");
  const status = String(formData.get("status") ?? "postado") as TrackingStatus;

  const existing = await db
    .select({ code: trackings.code })
    .from(trackings)
    .where(and(eq(trackings.orderId, orderId), inArray(trackings.code, codes)));
  const existingSet = new Set(existing.map((e) => e.code));
  const newCodes = codes.filter((c) => !existingSet.has(c));
  if (!newCodes.length) return { error: "Esses códigos já estão cadastrados neste pedido." };

  await db.transaction(async (tx) => {
    const carrierId = await resolveByName(tx, carriers, carrierName);
    await tx.insert(trackings).values(
      newCodes.map((code) => ({
        orderId,
        code,
        label,
        carrierId,
        status: TRACKING_STATUSES.includes(status) ? status : "postado",
      })),
    );
  });
  revalidateOrder(orderId);
  return { ok: true };
}

export async function updateTracking(orderId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await assertUser();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as TrackingStatus;
  const received = formData.get("received") === "on";
  const receivedDate = String(formData.get("receivedDate") ?? "");

  if (!TRACKING_STATUSES.includes(status)) return { error: "Status inválido." };

  await db.transaction(async (tx) => {
    const carrierId = await resolveByName(tx, carriers, String(formData.get("carrier") ?? ""));
    await tx
      .update(trackings)
      .set({
        code: String(formData.get("code") ?? "").trim().toUpperCase() || undefined,
        label: String(formData.get("label") ?? "").trim() || null,
        carrierId,
        status,
        received,
        receivedDate: received && /^\d{4}-\d{2}-\d{2}$/.test(receivedDate) ? receivedDate : null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .where(and(eq(trackings.id, id), eq(trackings.orderId, orderId)));
  });
  revalidateOrder(orderId);
  return { ok: true };
}

/** Altera o status de vários rastreios de uma vez. */
export async function bulkTrackingStatus(formData: FormData) {
  await assertUser();
  const orderId = Number(formData.get("orderId"));
  const status = String(formData.get("status")) as TrackingStatus;
  const ids = formData.getAll("ids").map(Number).filter(Boolean);
  if (!TRACKING_STATUSES.includes(status) || !ids.length) return;
  await db
    .update(trackings)
    .set({ status })
    .where(and(eq(trackings.orderId, orderId), inArray(trackings.id, ids)));
  revalidateOrder(orderId);
}

export async function deleteTracking(formData: FormData) {
  await assertUser();
  const id = Number(formData.get("id"));
  const orderId = Number(formData.get("orderId"));
  await db.delete(trackings).where(and(eq(trackings.id, id), eq(trackings.orderId, orderId)));
  revalidateOrder(orderId);
}

// ---------------- Conferência do recebimento ----------------

export type ConferenceInput = {
  items: {
    id: number;
    receivedQty: string;
    defectiveQty: string;
    checkNotes: string;
    receivedSizes: Record<string, string> | null;
  }[];
  trackings: { id: number; received: boolean; receivedDate: string }[];
  updateStatus: boolean;
};

const AUTO_STATUS_FROM: OrderStatus[] = ["cotacao", "confirmado", "em_producao", "enviado", "recebido_parcial", "recebido"];

export async function saveConference(orderId: number, input: ConferenceInput): Promise<{ error?: string }> {
  await assertUser();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true, trackings: true },
  });
  if (!order) return { error: "Pedido não encontrado." };

  const intOrNull = (v: string) => {
    const n = parseDecimal(v);
    return n === null ? null : Math.max(0, Math.round(n));
  };

  const itemIds = new Set(order.items.map((i) => i.id));
  const trackingIds = new Set(order.trackings.map((t) => t.id));

  await db.transaction(async (tx) => {
    // Uma única instrução por tabela (UPDATE ... FROM VALUES), em vez de uma por linha.
    const itemValues = input.items
      .filter((it) => itemIds.has(it.id))
      .map((it) => {
        let receivedSizes: SizeBreakdown | null = null;
        if (it.receivedSizes) {
          receivedSizes = {};
          for (const [size, q] of Object.entries(it.receivedSizes)) {
            const n = intOrNull(q);
            if (n !== null) receivedSizes[size] = n;
          }
          if (!Object.keys(receivedSizes).length) receivedSizes = null;
        }
        return sql`(${it.id}::int, ${intOrNull(it.receivedQty)}::int, ${intOrNull(it.defectiveQty)}::int, ${
          it.checkNotes.trim() || null
        }::text, ${receivedSizes ? JSON.stringify(receivedSizes) : null}::jsonb)`;
      });
    if (itemValues.length) {
      await tx.execute(sql`
        update order_items as oi set
          received_qty = v.rq, defective_qty = v.dq, check_notes = v.cn, received_sizes = v.rs
        from (values ${sql.join(itemValues, sql`, `)}) as v(id, rq, dq, cn, rs)
        where oi.id = v.id and oi.order_id = ${orderId}`);
    }

    const trackingValues = input.trackings
      .filter((t) => trackingIds.has(t.id))
      .map(
        (t) =>
          sql`(${t.id}::int, ${t.received}::boolean, ${
            t.received && /^\d{4}-\d{2}-\d{2}$/.test(t.receivedDate) ? t.receivedDate : null
          }::date)`,
      );
    if (trackingValues.length) {
      await tx.execute(sql`
        update trackings as t set
          received = v.rec,
          received_date = v.rdate,
          status = case when v.rec then 'entregue' else t.status end
        from (values ${sql.join(trackingValues, sql`, `)}) as v(id, rec, rdate)
        where t.id = v.id and t.order_id = ${orderId}`);
    }

    if (input.updateStatus && AUTO_STATUS_FROM.includes(order.status)) {
      const expected = order.items.reduce((s, i) => s + i.totalPieces, 0);
      const received = input.items.reduce((s, i) => s + (intOrNull(i.receivedQty) ?? 0), 0);
      if (received > 0) {
        await tx
          .update(orders)
          .set({ status: received >= expected ? "recebido" : "recebido_parcial", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }
    }
  });

  revalidateOrder(orderId);
  return {};
}
