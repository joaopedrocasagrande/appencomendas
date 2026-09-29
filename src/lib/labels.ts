import type { OrderStatus, TaxMode, TrackingStatus } from "@/db/schema";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  cotacao: "Cotação",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  enviado: "Enviado",
  recebido_parcial: "Recebido parcialmente",
  recebido: "Recebido",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  cotacao: "bg-slate-100 text-slate-700",
  confirmado: "bg-blue-100 text-blue-800",
  em_producao: "bg-indigo-100 text-indigo-800",
  enviado: "bg-amber-100 text-amber-800",
  recebido_parcial: "bg-orange-100 text-orange-800",
  recebido: "bg-emerald-100 text-emerald-800",
  finalizado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-700",
};

export const TRACKING_STATUS_LABEL: Record<TrackingStatus, string> = {
  aguardando_postagem: "Aguardando postagem",
  postado: "Postado",
  em_transito: "Em trânsito",
  fiscalizacao: "Fiscalização / Alfândega",
  aguardando_pagamento: "Aguardando pagamento de imposto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  devolvido: "Devolvido",
  extraviado: "Extraviado",
};

export const TRACKING_STATUS_COLOR: Record<TrackingStatus, string> = {
  aguardando_postagem: "bg-slate-100 text-slate-700",
  postado: "bg-blue-100 text-blue-800",
  em_transito: "bg-indigo-100 text-indigo-800",
  fiscalizacao: "bg-amber-100 text-amber-800",
  aguardando_pagamento: "bg-orange-100 text-orange-800",
  saiu_entrega: "bg-cyan-100 text-cyan-800",
  entregue: "bg-green-100 text-green-800",
  devolvido: "bg-red-100 text-red-700",
  extraviado: "bg-red-100 text-red-700",
};

export type PaymentStatus = "pendente" | "parcial" | "pago" | "pago_a_mais";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendente: "Pagamento pendente",
  parcial: "Pago parcialmente",
  pago: "Pago",
  pago_a_mais: "Pago a mais",
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  pendente: "bg-red-100 text-red-700",
  parcial: "bg-amber-100 text-amber-800",
  pago: "bg-green-100 text-green-800",
  pago_a_mais: "bg-purple-100 text-purple-800",
};

export const VARIANT_SUGGESTIONS = [
  "Masculino",
  "Feminino",
  "Infantil",
  "Kit Infantil",
  "Goleiro",
  "Manga longa",
];

export const SIZE_SUGGESTIONS = ["PP", "P", "M", "G", "GG", "XGG", "2XL", "3XL", "4XL"];

export const TAX_MODE_LABEL: Record<TaxMode, string> = {
  sem: "Sem imposto",
  incluso: "Incluso no pedido",
  por_fora: "Pago por fora",
};

export const TAX_MODE_HINT: Record<TaxMode, string> = {
  sem: "Este pedido não tem imposto.",
  incluso: "Já está dentro do valor pago ao fornecedor.",
  por_fora: "Pago depois, separado. Lance no pedido quando pagar.",
};
