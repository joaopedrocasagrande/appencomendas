export type ReceiptStatus = "nao_recebido" | "parcial" | "completo" | "divergencia";

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  nao_recebido: "Não recebido",
  parcial: "Recebido parcialmente",
  completo: "Recebido completo",
  divergencia: "Recebido com divergência",
};

export const RECEIPT_STATUS_COLOR: Record<ReceiptStatus, string> = {
  nao_recebido: "bg-slate-100 text-slate-700",
  parcial: "bg-amber-100 text-amber-800",
  completo: "bg-green-100 text-green-800",
  divergencia: "bg-red-100 text-red-700",
};

type ItemForReceipt = { totalPieces: number; receivedQty: number | null; defectiveQty: number | null };
type TrackingForReceipt = { received: boolean };

/**
 * Situação do recebimento a partir da conferência dos itens e dos pacotes:
 * - nada conferido e nenhum pacote recebido: não recebido
 * - algum item com defeito ou recebido a mais: divergência
 * - todos os itens recebidos na quantidade esperada: completo
 * - o resto: parcial
 */
export function computeReceipt(items: ItemForReceipt[], trackings: TrackingForReceipt[]) {
  const expected = items.reduce((s, i) => s + i.totalPieces, 0);
  const received = items.reduce((s, i) => s + (i.receivedQty ?? 0), 0);
  const defective = items.reduce((s, i) => s + (i.defectiveQty ?? 0), 0);
  const checked = items.some((i) => i.receivedQty !== null);
  const packagesReceived = trackings.filter((t) => t.received).length;

  let status: ReceiptStatus;
  if (!checked && packagesReceived === 0) status = "nao_recebido";
  else if (defective > 0 || items.some((i) => (i.receivedQty ?? 0) > i.totalPieces)) status = "divergencia";
  else if (items.length > 0 && items.every((i) => (i.receivedQty ?? 0) === i.totalPieces)) status = "completo";
  else status = "parcial";

  return {
    status,
    expected,
    received,
    defective,
    missing: Math.max(expected - received, 0),
    packagesReceived,
    packagesTotal: trackings.length,
  };
}
