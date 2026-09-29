import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";
import { NewUserForm, UserRowItem } from "./user-form";

export default async function UsersPage() {
  await requireAdminPage();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
    .from(users)
    .orderBy(asc(users.name));

  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" back="/cadastros" />
      <p className="text-sm text-slate-600">
        Funcionários veem e editam tudo, inclusive valores. Somente administradores excluem pedidos, pagamentos e
        cadastros, e gerenciam usuários. Para tirar o acesso de alguém, desmarque &quot;Ativo&quot;.
      </p>
      <Card title="Novo usuário">
        <NewUserForm />
      </Card>
      <Card title="Usuários cadastrados">
        <ul className="divide-y divide-slate-100">
          {rows.map((u) => (
            <UserRowItem key={u.id} user={u} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
