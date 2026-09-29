import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  return postgres(url, {
    // Necessário no pooler (modo transação) do Supabase.
    prepare: false,
    max: 5,
    // O Vercel congela a função entre requisições; conexões paradas são descartadas
    // em vez de ficarem penduradas, e uma conexão que não abre falha rápido.
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });
}

const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
