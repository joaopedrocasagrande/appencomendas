import type { Currency } from "@/db/schema";

const moneyFmt: Record<Currency, Intl.NumberFormat> = {
  BRL: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
  USD: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }),
};

export function fmtMoney(value: number | null | undefined, currency: Currency = "BRL") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return moneyFmt[currency].format(value);
}

export function fmtNumber(value: number | null | undefined, maxDecimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDecimals }).format(value);
}

/** "2026-09-07" -> "07/09/2026" */
export function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Aceita "1.234,56", "1234,56" ou "1234.56". Retorna null se vazio/inválido. */
export function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s/g, "").replace(/^R\$|^US\$|^\$/, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Número -> texto para inputs no formato brasileiro (sem separador de milhar). */
export function toInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10000) / 10000).replace(".", ",");
}

export function todayISO() {
  // Data local do Brasil, independentemente do fuso do servidor
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
