import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { loadOrder } from "@/lib/orders";
import { ConferenceForm } from "./conference-form";

export default async function ConferencePage({ params }: PageProps<"/pedidos/[id]/conferencia">) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const order = await loadOrder(id);
  if (!order) notFound();

  const str = (v: number | null) => (v === null ? "" : String(v));

  return (
    <div>
      <PageHeader title={`Conferência #${order.id}`} back={`/pedidos/${order.id}`} />
      <p className="mb-4 text-sm text-slate-600">
        {order.title}. Informe quanto chegou de cada item e marque os pacotes recebidos. Você pode conferir aos
        poucos e salvar quantas vezes precisar.
      </p>
      <ConferenceForm
        orderId={order.id}
        today={todayISO()}
        items={order.items.map((i) => ({
          id: i.id,
          productName: i.product.name,
          variant: i.variant,
          expected: i.totalPieces,
          sizes: i.sizes,
          receivedQty: str(i.receivedQty),
          defectiveQty: str(i.defectiveQty),
          checkNotes: i.checkNotes ?? "",
          receivedSizes: i.receivedSizes
            ? Object.fromEntries(Object.entries(i.receivedSizes).map(([s, q]) => [s, String(q)]))
            : null,
        }))}
        trackings={order.trackings
          .sort((a, b) => a.id - b.id)
          .map((t) => ({
            id: t.id,
            code: t.code,
            label: t.label,
            received: t.received,
            receivedDate: t.receivedDate ?? "",
          }))}
      />
    </div>
  );
}
