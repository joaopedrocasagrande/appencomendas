"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { btnPrimary, btnSecondary, btnSmall, Card, cx, Input, Textarea } from "@/components/ui";
import { parseDecimal } from "@/lib/format";
import { saveConference, type ConferenceInput } from "../../actions";

export type ConferenceItem = {
  id: number;
  productName: string;
  variant: string | null;
  expected: number;
  sizes: Record<string, number> | null;
  receivedQty: string;
  defectiveQty: string;
  checkNotes: string;
  receivedSizes: Record<string, string> | null;
};

export type ConferenceTracking = {
  id: number;
  code: string;
  label: string | null;
  received: boolean;
  receivedDate: string;
};

export function ConferenceForm({
  orderId,
  items: initialItems,
  trackings: initialTrackings,
  today,
}: {
  orderId: number;
  items: ConferenceItem[];
  trackings: ConferenceTracking[];
  today: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [trackings, setTrackings] = useState(initialTrackings);
  const [updateStatus, setUpdateStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patchItem = (id: number, patch: Partial<ConferenceItem>) =>
    setItems((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  function setSize(item: ConferenceItem, size: string, value: string) {
    const receivedSizes = { ...(item.receivedSizes ?? {}), [size]: value };
    const sum = Object.values(receivedSizes).reduce((s, v) => s + (parseDecimal(v) ?? 0), 0);
    patchItem(item.id, { receivedSizes, receivedQty: String(sum) });
  }

  function fillAll() {
    setItems((l) =>
      l.map((i) => ({
        ...i,
        receivedQty: String(i.expected),
        receivedSizes: i.sizes ? Object.fromEntries(Object.entries(i.sizes).map(([s, q]) => [s, String(q)])) : null,
      })),
    );
    setTrackings((l) => l.map((t) => ({ ...t, received: true, receivedDate: t.receivedDate || today })));
  }

  const expected = items.reduce((s, i) => s + i.expected, 0);
  const received = items.reduce((s, i) => s + (parseDecimal(i.receivedQty) ?? 0), 0);
  const defective = items.reduce((s, i) => s + (parseDecimal(i.defectiveQty) ?? 0), 0);

  function submit() {
    setError(null);
    const payload: ConferenceInput = {
      items: items.map((i) => ({
        id: i.id,
        receivedQty: i.receivedQty,
        defectiveQty: i.defectiveQty,
        checkNotes: i.checkNotes,
        receivedSizes: i.receivedSizes,
      })),
      trackings: trackings.map((t) => ({ id: t.id, received: t.received, receivedDate: t.receivedDate })),
      updateStatus,
    };
    startTransition(async () => {
      try {
        const res = await saveConference(orderId, payload);
        if (res.error) setError(res.error);
        else {
          router.push(`/pedidos/${orderId}`);
          router.refresh();
        }
      } catch {
        setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={fillAll}>
          ✓ Marcar tudo como recebido conforme o pedido
        </button>
      </div>

      {trackings.length > 0 && (
        <Card title={`Pacotes / rastreios (${trackings.filter((t) => t.received).length}/${trackings.length} recebidos)`}>
          <ul className="divide-y divide-slate-100">
            {trackings.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={t.received}
                    onChange={(e) =>
                      setTrackings((l) =>
                        l.map((x) =>
                          x.id === t.id
                            ? { ...x, received: e.target.checked, receivedDate: x.receivedDate || today }
                            : x,
                        ),
                      )
                    }
                  />
                  <span className="font-mono">{t.code}</span>
                  {t.label && <span className="text-slate-500">({t.label})</span>}
                </label>
                {t.received && (
                  <Input
                    type="date"
                    className="w-40"
                    value={t.receivedDate}
                    onChange={(e) =>
                      setTrackings((l) => l.map((x) => (x.id === t.id ? { ...x, receivedDate: e.target.value } : x)))
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Itens">
        <div className="space-y-3">
          {items.map((i) => {
            const rec = parseDecimal(i.receivedQty);
            const def = parseDecimal(i.defectiveQty) ?? 0;
            const diff = rec === null ? null : rec - i.expected;
            return (
              <div
                key={i.id}
                className={cx(
                  "rounded-lg border p-3",
                  rec === null
                    ? "border-slate-200"
                    : diff === 0 && def === 0
                      ? "border-green-300 bg-green-50/40"
                      : "border-amber-300 bg-amber-50/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{i.productName}</div>
                    <div className="text-xs text-slate-500">
                      {i.variant ? `${i.variant} · ` : ""}Esperado: <strong>{i.expected}</strong> peças
                    </div>
                  </div>
                  <button
                    type="button"
                    className={btnSmall}
                    onClick={() =>
                      patchItem(i.id, {
                        receivedQty: String(i.expected),
                        receivedSizes: i.sizes
                          ? Object.fromEntries(Object.entries(i.sizes).map(([s, q]) => [s, String(q)]))
                          : null,
                      })
                    }
                  >
                    Recebi tudo
                  </button>
                </div>

                {i.sizes && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(i.sizes).map(([size, exp]) => (
                      <label key={size} className="w-24 text-xs text-slate-600">
                        {size} (esp. {exp})
                        <Input
                          inputMode="numeric"
                          value={i.receivedSizes?.[size] ?? ""}
                          onChange={(e) => setSize(i, size, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs text-slate-600">
                    Recebido
                    <Input
                      inputMode="numeric"
                      value={i.receivedQty}
                      onChange={(e) => patchItem(i.id, { receivedQty: e.target.value })}
                      className="font-semibold"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Com defeito
                    <Input
                      inputMode="numeric"
                      value={i.defectiveQty}
                      onChange={(e) => patchItem(i.id, { defectiveQty: e.target.value })}
                    />
                  </label>
                  <label className="col-span-2 text-xs text-slate-600">
                    Observação
                    <Textarea
                      rows={1}
                      value={i.checkNotes}
                      onChange={(e) => patchItem(i.id, { checkNotes: e.target.value })}
                    />
                  </label>
                </div>
                {diff !== null && (diff !== 0 || def > 0) && (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    {diff < 0 && `Faltam ${-diff} peças. `}
                    {diff > 0 && `Vieram ${diff} peças a mais. `}
                    {def > 0 && `${def} com defeito.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="sticky bottom-16 z-10 rounded-xl border border-blue-200 bg-white p-4 shadow-lg md:bottom-2">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500">Esperado</div>
            <div className="font-semibold">{expected}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Recebido</div>
            <div className={cx("font-semibold", received < expected ? "text-amber-700" : "text-green-700")}>
              {received}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Com defeito</div>
            <div className={cx("font-semibold", defective > 0 && "text-red-600")}>{defective}</div>
          </div>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4"
            checked={updateStatus}
            onChange={(e) => setUpdateStatus(e.target.checked)}
          />
          Atualizar status do pedido (Recebido / Recebido parcialmente)
        </label>
        {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" className={cx(btnPrimary, "flex-1 sm:flex-none")} disabled={pending} onClick={submit}>
            {pending ? "Salvando..." : "Salvar conferência"}
          </button>
          <button type="button" className={btnSecondary} onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
