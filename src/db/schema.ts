import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Valores monetários: numeric(14,2). Preço unitário e cotação usam 4 casas.
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const price = (name: string) => numeric(name, { precision: 14, scale: 4 });
const rate = (name: string) => numeric(name, { precision: 12, scale: 4 });
const qty = (name: string) => numeric(name, { precision: 12, scale: 2 });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "funcionario"] }).notNull().default("funcionario"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contact: text("contact"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdAt: createdAt(),
});

// Modalidade de transporte (Aéreo, Marítimo, Expresso...)
export const transportModes = pgTable("transport_modes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  defaultDays: integer("default_days"),
  createdAt: createdAt(),
});

// Transportadora (Correios - Sedex, Fedex, DHL...)
export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  // URL de consulta externa; "{code}" é substituído pelo código de rastreio.
  trackingUrl: text("tracking_url"),
  createdAt: createdAt(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

// Cotação do dólar definida manualmente por dia (R$ por US$ 1).
export const exchangeRates = pgTable("exchange_rates", {
  day: date("day").primaryKey(),
  usdBrl: rate("usd_brl").notNull(),
  createdAt: createdAt(),
});

export const ORDER_STATUSES = [
  "cotacao",
  "confirmado",
  "em_producao",
  "enviado",
  "recebido_parcial",
  "recebido",
  "finalizado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CURRENCIES = ["USD", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  orderDate: date("order_date"),
  expectedDate: date("expected_date"),
  transportModeId: integer("transport_mode_id").references(() => transportModes.id),
  carrierId: integer("carrier_id").references(() => carriers.id),
  currency: text("currency", { enum: CURRENCIES }).notNull().default("BRL"),
  // R$ por US$ 1 usado para converter os valores do pedido.
  exchangeRate: rate("exchange_rate"),
  freight: money("freight").notNull().default("0"),
  discount: money("discount").notNull().default("0"),
  hasTax: boolean("has_tax").notNull().default(false),
  taxIncluded: boolean("tax_included").notNull().default(false),
  taxAmount: money("tax_amount").notNull().default("0"),
  // Só relevante quando o imposto não está incluso (pago à parte).
  taxPaid: boolean("tax_paid").notNull().default(false),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("confirmado"),
  notes: text("notes"),
  needsReview: boolean("needs_review").notNull().default(false),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SizeBreakdown = Record<string, number>;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  variant: text("variant"),
  boxes: qty("boxes"),
  piecesPerBox: qty("pieces_per_box"),
  grids: qty("grids"),
  piecesPerGrid: qty("pieces_per_grid"),
  totalPieces: integer("total_pieces").notNull().default(0),
  unitPrice: price("unit_price").notNull().default("0"),
  sizes: jsonb("sizes").$type<SizeBreakdown>(),
  // Conferência no recebimento
  receivedQty: integer("received_qty"),
  defectiveQty: integer("defective_qty"),
  checkNotes: text("check_notes"),
  position: integer("position").notNull().default(0),
});

export const orderExpenses = pgTable("order_expenses", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: money("amount").notNull(),
  currency: text("currency", { enum: CURRENCIES }).notNull().default("BRL"),
  // true: cobrada pelo fornecedor e entra no total a pagar a ele.
  chargedBySupplier: boolean("charged_by_supplier").notNull().default(false),
  // Só relevante quando não é cobrada pelo fornecedor.
  paid: boolean("paid").notNull().default(false),
  createdAt: createdAt(),
});

export const TRACKING_STATUSES = [
  "aguardando_postagem",
  "postado",
  "em_transito",
  "fiscalizacao",
  "aguardando_pagamento",
  "saiu_entrega",
  "entregue",
  "devolvido",
  "extraviado",
] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const trackings = pgTable("trackings", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  carrierId: integer("carrier_id").references(() => carriers.id),
  // Conteúdo do pacote, ex.: "Internacional", "Grêmio"
  label: text("label"),
  status: text("status", { enum: TRACKING_STATUSES }).notNull().default("postado"),
  taxAmount: money("tax_amount").notNull().default("0"),
  taxCurrency: text("tax_currency", { enum: CURRENCIES }).notNull().default("BRL"),
  taxPaid: boolean("tax_paid").notNull().default(false),
  // Conferência por pacote
  received: boolean("received").notNull().default(false),
  receivedDate: date("received_date"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paidOn: date("paid_on").notNull(),
  amount: money("amount").notNull(),
  currency: text("currency", { enum: CURRENCIES }).notNull(),
  exchangeRate: rate("exchange_rate"),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [orders.supplierId], references: [suppliers.id] }),
  transportMode: one(transportModes, {
    fields: [orders.transportModeId],
    references: [transportModes.id],
  }),
  carrier: one(carriers, { fields: [orders.carrierId], references: [carriers.id] }),
  items: many(orderItems),
  expenses: many(orderExpenses),
  trackings: many(trackings),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderExpensesRelations = relations(orderExpenses, ({ one }) => ({
  order: one(orders, { fields: [orderExpenses.orderId], references: [orders.id] }),
}));

export const trackingsRelations = relations(trackings, ({ one }) => ({
  order: one(orders, { fields: [trackings.orderId], references: [orders.id] }),
  carrier: one(carriers, { fields: [trackings.carrierId], references: [carriers.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  method: one(paymentMethods, {
    fields: [payments.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));
