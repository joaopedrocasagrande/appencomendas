import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ENTITIES } from "./config";

export default async function CadastrosPage() {
  const user = await requireUser();
  const links = [
    ...Object.entries(ENTITIES).map(([slug, c]) => ({ href: `/cadastros/${slug}`, title: c.title, desc: c.description })),
    { href: "/cotacoes", title: "Cotação do dólar", desc: "Valor do dólar que você define a cada dia." },
    { href: "/diagnostico", title: "Diagnóstico", desc: "Velocidade da conexão do app com o banco." },
    ...(user.role === "admin"
      ? [{ href: "/cadastros/usuarios", title: "Usuários", desc: "Acesso de funcionários ao app." }]
      : []),
  ];
  return (
    <div>
      <PageHeader title="Cadastros" />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link prefetch={false}
            key={l.href}
            href={l.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300"
          >
            <div className="font-semibold text-slate-900">{l.title}</div>
            <div className="text-sm text-slate-500">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
