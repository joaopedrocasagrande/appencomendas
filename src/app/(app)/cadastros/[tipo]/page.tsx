import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { carriers, paymentMethods, products, suppliers, transportModes } from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ENTITIES, isEntitySlug } from "../config";
import { EntityRow, NewEntityForm } from "../entity-form";

const TABLES = {
  fornecedores: suppliers,
  produtos: products,
  modalidades: transportModes,
  transportadoras: carriers,
  "formas-pagamento": paymentMethods,
} as const;

export default async function EntityPage({ params }: PageProps<"/cadastros/[tipo]">) {
  const user = await requireUser();
  const { tipo } = await params;
  if (!isEntitySlug(tipo)) notFound();
  const config = ENTITIES[tipo];
  const table = TABLES[tipo];
  const rows = (await db.select().from(table).orderBy(asc(table.name))) as unknown as ({
    id: number;
  } & Record<string, string | number | null>)[];

  return (
    <div className="space-y-4">
      <PageHeader title={config.title} back="/cadastros" />
      <p className="text-sm text-slate-600">{config.description}</p>
      <Card title={`Novo ${config.singular}`}>
        <NewEntityForm slug={tipo} fields={config.fields} singular={config.singular} />
      </Card>
      <Card title={`${rows.length} cadastrado(s)`}>
        {rows.length === 0 ? (
          <EmptyState>Nenhum cadastro ainda.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <EntityRow
                key={row.id}
                slug={tipo}
                fields={config.fields}
                row={row}
                canDelete={user.role === "admin"}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
