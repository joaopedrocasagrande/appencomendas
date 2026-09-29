import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { toInput, todayISO } from "@/lib/format";
import { loadOptions } from "@/lib/orders";
import { getRateFor } from "@/lib/rates";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  await requireUser();
  const [options, rate] = await Promise.all([loadOptions(), getRateFor()]);
  return (
    <div>
      <PageHeader title="Novo pedido" back="/pedidos" />
      <OrderForm options={options} defaultRate={rate ? toInput(rate.rate) : ""} today={todayISO()} />
    </div>
  );
}
