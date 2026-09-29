import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { convert } from "@/lib/finance";
import { todayISO } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, TAX_MODE_LABEL, TRACKING_STATUS_LABEL } from "@/lib/labels";
import { queryOrders } from "@/lib/order-query";
import { RECEIPT_STATUS_LABEL } from "@/lib/receiving";

const MONEY = "#,##0.00";
const INT = "#,##0";

// "2026-09-07" -> Date em UTC, para o Excel mostrar a data sem deslocar o dia
const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
const num = (v: string | number | null) => (v === null || v === "" ? null : Number(v));

type Col = { header: string; key: string; width?: number; fmt?: string };

function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(12, c.header.length + 2),
    style: c.fmt ? { numFmt: c.fmt } : undefined,
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  ws.addRows(rows);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { list } = await queryOrders(sp);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Encomendas";

  const DATE = "dd/mm/yyyy";

  addSheet(
    wb,
    "Pedidos",
    [
      { header: "Nº", key: "id", width: 6 },
      { header: "Título", key: "title", width: 36 },
      { header: "Fornecedor", key: "supplier", width: 18 },
      { header: "Data do pedido", key: "orderDate", fmt: DATE },
      { header: "Previsão", key: "expectedDate", fmt: DATE },
      { header: "Modalidade", key: "mode" },
      { header: "Transportadora", key: "carrier", width: 16 },
      { header: "Status", key: "status", width: 18 },
      { header: "Moeda", key: "currency", width: 8 },
      { header: "Cotação", key: "rate", fmt: "0.0000" },
      { header: "Peças", key: "pieces", fmt: INT },
      { header: "Produtos", key: "itemsTotal", fmt: MONEY },
      { header: "Frete", key: "freight", fmt: MONEY },
      { header: "Desconto", key: "discount", fmt: MONEY },
      { header: "Despesas do fornecedor", key: "supplierExpenses", fmt: MONEY },
      { header: "Total ao fornecedor", key: "supplierTotal", fmt: MONEY },
      { header: "Pago", key: "paid", fmt: MONEY },
      { header: "Falta pagar", key: "pending", fmt: MONEY },
      { header: "Pagamento", key: "paymentStatus", width: 18 },
      { header: "Imposto", key: "taxMode", width: 16 },
      { header: "Imposto (R$)", key: "tax", fmt: MONEY },
      { header: "Imposto/despesas à parte (R$)", key: "extras", fmt: MONEY },
      { header: "Custo total (R$)", key: "landed", fmt: MONEY },
      { header: "Custo por peça (R$)", key: "costPerPiece", fmt: MONEY },
      { header: "Recebimento", key: "receipt", width: 22 },
      { header: "Peças recebidas", key: "received", fmt: INT },
      { header: "Com defeito", key: "defective", fmt: INT },
      { header: "Rastreios", key: "trackings", fmt: INT },
      { header: "Observações", key: "notes", width: 40 },
    ],
    list.map(({ o, t, r }) => ({
      id: o.id,
      title: o.title,
      supplier: o.supplier?.name ?? "",
      orderDate: toDate(o.orderDate),
      expectedDate: toDate(o.expectedDate),
      mode: o.transportMode?.name ?? "",
      carrier: o.carrier?.name ?? "",
      status: ORDER_STATUS_LABEL[o.status],
      currency: o.currency === "USD" ? "$" : "R$",
      rate: num(o.exchangeRate),
      pieces: t.pieces,
      itemsTotal: t.itemsTotal,
      freight: t.freight,
      discount: t.discount,
      supplierExpenses: t.supplierExpenses,
      supplierTotal: t.supplierTotal,
      paid: t.paid,
      pending: t.pending,
      paymentStatus: PAYMENT_STATUS_LABEL[t.paymentStatus],
      taxMode: TAX_MODE_LABEL[o.taxMode],
      tax: t.taxTotalBRL,
      extras: t.extrasBRL,
      landed: t.landedBRL,
      costPerPiece: t.costPerPieceBRL,
      receipt: RECEIPT_STATUS_LABEL[r.status],
      received: r.received,
      defective: r.defective,
      trackings: o.trackings.length,
      notes: o.notes ?? "",
    })),
  );

  addSheet(
    wb,
    "Itens",
    [
      { header: "Nº pedido", key: "orderId", width: 9 },
      { header: "Pedido", key: "title", width: 30 },
      { header: "Fornecedor", key: "supplier", width: 16 },
      { header: "Produto", key: "product", width: 40 },
      { header: "Variação", key: "variant" },
      { header: "Caixas", key: "boxes", fmt: "0.##" },
      { header: "Peças/caixa", key: "ppb", fmt: "0.##" },
      { header: "Grades", key: "grids", fmt: "0.##" },
      { header: "Peças/grade", key: "ppg", fmt: "0.##" },
      { header: "Total de peças", key: "pieces", fmt: INT },
      { header: "Valor unitário", key: "unit", fmt: MONEY },
      { header: "Moeda", key: "currency", width: 8 },
      { header: "Total", key: "total", fmt: MONEY },
      { header: "Tamanhos", key: "sizes", width: 24 },
      { header: "Recebido", key: "received", fmt: INT },
      { header: "Com defeito", key: "defective", fmt: INT },
      { header: "Obs. conferência", key: "checkNotes", width: 30 },
    ],
    list.flatMap(({ o }) =>
      o.items.map((i) => ({
        orderId: o.id,
        title: o.title,
        supplier: o.supplier?.name ?? "",
        product: i.product.name,
        variant: i.variant ?? "",
        boxes: num(i.boxes),
        ppb: num(i.piecesPerBox),
        grids: num(i.grids),
        ppg: num(i.piecesPerGrid),
        pieces: i.totalPieces,
        unit: num(i.unitPrice),
        currency: o.currency === "USD" ? "$" : "R$",
        total: i.totalPieces * Number(i.unitPrice),
        sizes: i.sizes ? Object.entries(i.sizes).map(([s, q]) => `${s}: ${q}`).join(", ") : "",
        received: i.receivedQty,
        defective: i.defectiveQty,
        checkNotes: i.checkNotes ?? "",
      })),
    ),
  );

  addSheet(
    wb,
    "Pagamentos",
    [
      { header: "Nº pedido", key: "orderId", width: 9 },
      { header: "Pedido", key: "title", width: 30 },
      { header: "Fornecedor", key: "supplier", width: 16 },
      { header: "Data", key: "date", fmt: DATE },
      { header: "Valor", key: "amount", fmt: MONEY },
      { header: "Moeda", key: "currency", width: 8 },
      { header: "Cotação", key: "rate", fmt: "0.0000" },
      { header: "Valor em R$", key: "brl", fmt: MONEY },
      { header: "Forma de pagamento", key: "method", width: 18 },
      { header: "Observação", key: "notes", width: 30 },
    ],
    list.flatMap(({ o, t }) =>
      o.payments.map((p) => ({
        orderId: o.id,
        title: o.title,
        supplier: o.supplier?.name ?? "",
        date: toDate(p.paidOn),
        amount: num(p.amount),
        currency: p.currency === "USD" ? "$" : "R$",
        rate: num(p.exchangeRate),
        brl: convert(Number(p.amount), p.currency, "BRL", Number(p.exchangeRate) || t.orderRate),
        method: p.method?.name ?? "",
        notes: p.notes ?? "",
      })),
    ),
  );

  addSheet(
    wb,
    "Impostos",
    [
      { header: "Nº pedido", key: "orderId", width: 9 },
      { header: "Pedido", key: "title", width: 30 },
      { header: "Data", key: "date", fmt: DATE },
      { header: "Valor", key: "amount", fmt: MONEY },
      { header: "Moeda", key: "currency", width: 8 },
      { header: "Cotação", key: "rate", fmt: "0.0000" },
      { header: "Pacote", key: "tracking", width: 18 },
      { header: "Observação", key: "notes", width: 30 },
    ],
    list.flatMap(({ o }) =>
      o.taxPayments.map((tp) => ({
        orderId: o.id,
        title: o.title,
        date: toDate(tp.paidOn),
        amount: num(tp.amount),
        currency: tp.currency === "USD" ? "$" : "R$",
        rate: num(tp.exchangeRate),
        tracking: tp.tracking?.code ?? "Pedido todo",
        notes: tp.notes ?? "",
      })),
    ),
  );

  addSheet(
    wb,
    "Rastreios",
    [
      { header: "Nº pedido", key: "orderId", width: 9 },
      { header: "Pedido", key: "title", width: 30 },
      { header: "Código", key: "code", width: 18 },
      { header: "Conteúdo", key: "label", width: 16 },
      { header: "Transportadora", key: "carrier", width: 16 },
      { header: "Status", key: "status", width: 24 },
      { header: "Recebido", key: "received", width: 10 },
      { header: "Data recebimento", key: "receivedDate", fmt: DATE },
      { header: "Observação", key: "notes", width: 30 },
    ],
    list.flatMap(({ o }) =>
      o.trackings.map((tr) => ({
        orderId: o.id,
        title: o.title,
        code: tr.code,
        label: tr.label ?? "",
        carrier: tr.carrier?.name ?? "",
        status: TRACKING_STATUS_LABEL[tr.status],
        received: tr.received ? "Sim" : "Não",
        receivedDate: toDate(tr.receivedDate),
        notes: tr.notes ?? "",
      })),
    ),
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pedidos-${todayISO()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
