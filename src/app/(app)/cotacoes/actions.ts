"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { assertAdmin, assertUser } from "@/lib/auth";
import { parseDecimal } from "@/lib/format";
import { getRateFor } from "@/lib/rates";

export type RateResult = { error?: string; ok?: boolean } | undefined;

export async function saveRate(_prev: RateResult, formData: FormData): Promise<RateResult> {
  await assertUser();
  const day = String(formData.get("day") ?? "");
  const rate = parseDecimal(formData.get("rate"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Data inválida." };
  if (!rate || rate <= 0) return { error: "Informe a cotação (ex.: 5,42)." };

  await db
    .insert(exchangeRates)
    .values({ day, usdBrl: String(rate) })
    .onConflictDoUpdate({ target: exchangeRates.day, set: { usdBrl: String(rate) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRate(formData: FormData) {
  await assertAdmin();
  await db.delete(exchangeRates).where(eq(exchangeRates.day, String(formData.get("day"))));
  revalidatePath("/", "layout");
}

/** Usado pelos formulários para sugerir a cotação de uma data. */
export async function rateForDay(day: string) {
  await assertUser();
  return getRateFor(day || undefined);
}
