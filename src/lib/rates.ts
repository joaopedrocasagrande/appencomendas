import { desc, lte } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { todayISO } from "./format";

/** Cotação definida para o dia informado ou, se não houver, a última anterior a ele. */
export async function getRateFor(day: string = todayISO()) {
  const row = await db.query.exchangeRates.findFirst({
    where: lte(exchangeRates.day, day),
    orderBy: desc(exchangeRates.day),
  });
  return row ? { day: row.day, rate: Number(row.usdBrl) } : null;
}
