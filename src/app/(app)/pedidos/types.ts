import { z } from "zod";
import { CURRENCIES, ORDER_STATUSES } from "@/db/schema";

const text = z.string().trim().max(500).optional().default("");
const date = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida")
  .optional()
  .default("");
// Números chegam como texto no formato brasileiro ("1.234,56") e são convertidos no servidor.
const num = z.string().max(40).optional().default("");

export const itemSchema = z.object({
  id: z.number().int().positive().optional(),
  productName: z.string().trim().min(1, "Informe o produto de todos os itens").max(300),
  variant: text,
  boxes: num,
  piecesPerBox: num,
  grids: num,
  piecesPerGrid: num,
  totalPieces: num,
  unitPrice: num,
  sizes: z
    .array(z.object({ size: z.string().trim().max(20), qty: num }))
    .max(40)
    .nullable()
    .optional(),
});

export const expenseSchema = z.object({
  id: z.number().int().positive().optional(),
  description: z.string().trim().min(1, "Informe a descrição da despesa").max(300),
  amount: num,
  currency: z.enum(CURRENCIES),
  chargedBySupplier: z.boolean(),
  paid: z.boolean(),
});

export const orderSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(1, "Informe o título do pedido").max(300),
  supplierName: text,
  orderDate: date,
  expectedDate: date,
  transportModeName: text,
  carrierName: text,
  currency: z.enum(CURRENCIES),
  exchangeRate: num,
  freight: num,
  discount: num,
  hasTax: z.boolean(),
  taxIncluded: z.boolean(),
  taxAmount: num,
  taxPaid: z.boolean(),
  status: z.enum(ORDER_STATUSES),
  notes: z.string().max(5000).optional().default(""),
  needsReview: z.boolean(),
  items: z.array(itemSchema).max(500),
  expenses: z.array(expenseSchema).max(100),
});

export type OrderInput = z.input<typeof orderSchema>;
export type ItemInput = z.input<typeof itemSchema>;
export type ExpenseInput = z.input<typeof expenseSchema>;
