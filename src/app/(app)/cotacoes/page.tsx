import { desc } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { btnSmall, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, toInput, todayISO } from "@/lib/format";
import { deleteRate } from "./actions";
import { RateForm } from "./rate-form";

export default async function RatesPage() {
  const user = await requireUser();
  const today = todayISO();
  const rows = await db.select().from(exchangeRates).orderBy(desc(exchangeRates.day)).limit(90);
  const todayRow = rows.find((r) => r.day === today);

  return (
    <div className="space-y-4">
      <PageHeader title="Cotação do dólar" />
      <p className="text-sm text-slate-600">
        Defina o valor do dólar do dia. Ele é sugerido automaticamente nos pedidos e pagamentos daquela data (você
        ainda pode ajustar em cada um). Se um dia não tiver cotação, é usada a última cadastrada antes dele.
      </p>
      <Card title={todayRow ? `Hoje: $1 = ${fmtMoney(Number(todayRow.usdBrl))}` : "Cotação de hoje ainda não definida"}>
        <RateForm today={today} current={todayRow ? toInput(todayRow.usdBrl) : undefined} />
      </Card>
      <Card title="Histórico">
        {rows.length === 0 ? (
          <EmptyState>Nenhuma cotação cadastrada.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.day} className="flex items-center justify-between py-2 text-sm">
                <span>{fmtDate(r.day)}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-medium">{fmtMoney(Number(r.usdBrl))}</span>
                  {user.role === "admin" && (
                    <form action={deleteRate}>
                      <input type="hidden" name="day" value={r.day} />
                      <button className={btnSmall}>Excluir</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
