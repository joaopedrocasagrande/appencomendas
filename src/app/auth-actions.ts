"use server";

import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export type FormState = { error?: string } | undefined;

async function startSession(userId: number) {
  const token = await signSession({ userId });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = await db.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }
  if (!user.active) return { error: "Usuário desativado. Fale com o administrador." };

  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function hasAnyUser() {
  const [{ total }] = await db.select({ total: count() }).from(users);
  return total > 0;
}

/** Cria o primeiro administrador. Só funciona enquanto não existir nenhum usuário. */
export async function setupAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await hasAnyUser()) return { error: "O administrador já foi criado. Faça login." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };

  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 10), role: "admin" })
    .returning({ id: users.id });
  await startSession(created.id);
  redirect("/");
}
