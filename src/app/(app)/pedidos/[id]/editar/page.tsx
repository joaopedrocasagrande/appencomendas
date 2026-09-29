import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { toInput, todayISO } from "@/lib/format";
import { loadOptions, loadOrder } from "@/lib/orders";
import { OrderForm, type OrderFormInitial } from "../../order-form";

export default async function EditOrderPage({ params }: PageProps<"/pedidos/[id]/editar">) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [order, options] = await Promise.all([loadOrder(id), loadOptions()]);
  if (!order) notFound();

  const initial: OrderFormInitial = {
    id: order.id,
    title: order.title,
    supplierName: order.supplier?.name ?? "",
    orderDate: order.orderDate ?? "",
    expectedDate: order.expectedDate ?? "",
    transportModeName: order.transportMode?.name ?? "",
    carrierName: order.carrier?.name ?? "",
    currency: order.currency,
    exchangeRate: toInput(order.exchangeRate),
    freight: toInput(order.freight),
    discount: toInput(order.discount),
    taxMode: order.taxMode,
    taxAmount: order.taxMode === "incluso" && Number(order.taxAmount) ? toInput(order.taxAmount) : "",
    status: order.status,
    notes: order.notes ?? "",
    needsReview: order.needsReview,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.product.name,
      variant: i.variant ?? "",
      boxes: toInput(i.boxes),
      piecesPerBox: toInput(i.piecesPerBox),
      grids: toInput(i.grids),
      piecesPerGrid: toInput(i.piecesPerGrid),
      totalPieces: String(i.totalPieces),
      unitPrice: toInput(i.unitPrice),
      sizes: i.sizes ? Object.entries(i.sizes).map(([size, qty]) => ({ size, qty: String(qty) })) : null,
    })),
    expenses: order.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: toInput(e.amount),
      currency: e.currency,
      chargedBySupplier: e.chargedBySupplier,
      paid: e.paid,
    })),
  };

  return (
    <div>
      <PageHeader title={`Editar pedido #${order.id}`} back={`/pedidos/${order.id}`} />
      <OrderForm initial={initial} options={options} defaultRate="" today={todayISO()} />
    </div>
  );
}
