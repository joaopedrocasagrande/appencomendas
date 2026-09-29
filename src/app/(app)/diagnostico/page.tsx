import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";

// Momento em que esta instância do servidor iniciou (indica "partida a frio").
const startedAt = Date.now();

function dbHost() {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "não configurado";
  }
}

export default async function DiagnosticPage() {
  const t0 = performance.now();
  await requireUser();
  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await db.execute(sql`select 1`);
    pings.push(Math.round(performance.now() - t));
  }
  const warm = pings.slice(1);
  const avg = Math.round(warm.reduce((s, v) => s + v, 0) / warm.length);
  const region = process.env.VERCEL_REGION ?? "local (fora do Vercel)";
  const uptime = Math.round((Date.now() - startedAt) / 1000);
  const total = Math.round(performance.now() - t0);

  const regionOk = region.startsWith("gru");
  const verdict =
    avg <= 15
      ? { tone: "green" as const, text: "Conexão com o banco rápida." }
      : avg <= 60
        ? { tone: "amber" as const, text: "Conexão com o banco razoável." }
        : { tone: "red" as const, text: "Conexão com o banco lenta: servidor e banco provavelmente em regiões diferentes." };

  return (
    <div className="space-y-4">
      <PageHeader title="Diagnóstico" back="/cadastros" />
      <p className="text-sm text-slate-600">
        Tire um print desta tela e envie para o suporte. Atualize a página 2 ou 3 vezes para comparar.
      </p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Região do servidor"
          value={region}
          sub={regionOk ? "São Paulo (correto)" : "Deveria ser gru1 (São Paulo)"}
          tone={regionOk ? "green" : "red"}
        />
        <Stat label="Banco: tempo por consulta" value={`${avg} ms`} sub={verdict.text} tone={verdict.tone} />
        <Stat label="Primeira consulta" value={`${pings[0]} ms`} sub="Inclui abrir a conexão" />
        <Stat label="Tempo total desta página" value={`${total} ms`} sub={`Servidor ativo há ${uptime}s`} />
      </div>
      <Card title="Detalhes">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Endereço do banco</dt>
            <dd className="font-mono">{dbHost()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Consultas (ms)</dt>
            <dd className="font-mono">{pings.join(" · ")}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
