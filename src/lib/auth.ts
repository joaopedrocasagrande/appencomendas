import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "funcionario";
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Para páginas: redireciona ao login se não autenticado. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Para server actions: lança erro se não autenticado. */
export async function assertUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessão expirada. Faça login novamente.");
  return user;
}

export async function assertAdmin() {
  const user = await assertUser();
  if (user.role !== "admin") throw new Error("Apenas administradores podem fazer isso.");
  return user;
}
