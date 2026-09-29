"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { carriers, paymentMethods, products, suppliers, transportModes, users } from "@/db/schema";
import { assertAdmin, assertUser } from "@/lib/auth";
import { ENTITIES, isEntitySlug, type EntityField, type EntitySlug } from "./config";

export type ActionResult = { error?: string; ok?: boolean } | undefined;

const TABLES = {
  fornecedores: suppliers,
  produtos: products,
  modalidades: transportModes,
  transportadoras: carriers,
  "formas-pagamento": paymentMethods,
} as const;

function readValues(slug: EntitySlug, formData: FormData) {
  const values: Record<string, string | number | null> = {};
  for (const f of ENTITIES[slug].fields as EntityField[]) {
    const raw = String(formData.get(f.key) ?? "").trim();
    if (f.type === "number") {
      const n = raw ? Number(raw.replace(",", ".")) : null;
      values[f.key] = n !== null && Number.isFinite(n) ? Math.round(n) : null;
    } else {
      values[f.key] = raw || null;
    }
  }
  return values;
}

function friendlyDbError(err: unknown, singular: string): string {
  const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
  if (code === "23505") return `Já existe um(a) ${singular} com esse nome.`;
  if (code === "23503") return `Não é possível excluir: este(a) ${singular} está em uso em algum pedido.`;
  return "Não foi possível salvar. Tente novamente.";
}

export async function saveEntity(slug: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await assertUser();
  if (!isEntitySlug(slug)) return { error: "Cadastro inválido." };
  const table = TABLES[slug];
  const values = readValues(slug, formData);
  if (!values.name) return { error: "Informe o nome." };

  const id = Number(formData.get("id") || 0);
  // Nome único sem diferenciar maiúsculas/minúsculas
  const dup = await db
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(sql`lower(${table.name})`, String(values.name).toLowerCase()),
        id ? ne(table.id, id) : undefined,
      ),
    )
    .limit(1);
  if (dup.length) return { error: `Já existe um(a) ${ENTITIES[slug].singular} com esse nome.` };

  try {
    if (id) {
      await db.update(table).set(values).where(eq(table.id, id));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(table).values(values as any);
    }
  } catch (err) {
    return { error: friendlyDbError(err, ENTITIES[slug].singular) };
  }
  revalidatePath(`/cadastros/${slug}`);
  return { ok: true };
}

export async function deleteEntity(slug: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  if (!isEntitySlug(slug)) return { error: "Cadastro inválido." };
  const table = TABLES[slug];
  try {
    await db.delete(table).where(eq(table.id, Number(formData.get("id"))));
  } catch (err) {
    return { error: friendlyDbError(err, ENTITIES[slug].singular) };
  }
  revalidatePath(`/cadastros/${slug}`);
  return { ok: true };
}

// ---- Usuários (somente administrador) ----

export async function saveUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await assertAdmin();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "funcionario";
  const active = formData.get("active") === "on";

  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (!id && password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };
  if (id && password && password.length < 6) return { error: "A nova senha precisa ter pelo menos 6 caracteres." };
  if (id === me.id && (role !== "admin" || !active)) {
    return { error: "Você não pode remover seu próprio acesso de administrador." };
  }

  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(sql`lower(${users.email})`, email), id ? ne(users.id, id) : undefined))
    .limit(1);
  if (dup.length) return { error: "Já existe um usuário com esse e-mail." };

  const data = {
    name,
    email,
    role,
    active,
    ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
  } as const;

  if (id) await db.update(users).set(data).where(eq(users.id, id));
  else await db.insert(users).values({ ...data, passwordHash: await bcrypt.hash(password, 10) });

  revalidatePath("/cadastros/usuarios");
  return { ok: true };
}
