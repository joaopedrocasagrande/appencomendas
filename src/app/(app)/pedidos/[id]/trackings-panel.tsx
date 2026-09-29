"use client";

import { SubmitButton } from "@/components/submit-button";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  Badge,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cx,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { TRACKING_STATUSES, type TrackingStatus } from "@/db/schema";
import { fmtDate, fmtMoney } from "@/lib/format";
import { TRACKING_STATUS_COLOR, TRACKING_STATUS_LABEL } from "@/lib/labels";
import { addTrackings, bulkTrackingStatus, deleteTracking, updateTracking, type ActionResult } from "../actions";

export type TrackingView = {
  id: number;
  code: string;
  label: string | null;
  carrierName: string;
  status: TrackingStatus;
  // Soma dos impostos lançados para este pacote, em R$
  taxBRL: number;
  received: boolean;
  receivedDate: string | null;
  notes: string | null;
  link: string;
};

function StatusOptions() {
  return (
    <>
      {TRACKING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TRACKING_STATUS_LABEL[s]}
        </option>
      ))}
    </>
  );
}

export function TrackingsPanel({
  orderId,
  trackings,
  carriers,
  defaultCarrier,
  today,
}: {
  orderId: number;
  trackings: TrackingView[];
  carriers: string[];
  defaultCarrier: string;
  today: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(trackings.length === 0);
  const [addState, addAction, addPending] = useActionState(addTrackings.bind(null, orderId), undefined);
  const addRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState?.ok) addRef.current?.reset();
  }, [addState]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const counts = trackings.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <datalist id="dl-carriers">
        {carriers.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {trackings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(counts).map(([s, n]) => (
            <Badge key={s} className={TRACKING_STATUS_COLOR[s as TrackingStatus]}>
              {TRACKING_STATUS_LABEL[s as TrackingStatus]}: {n}
            </Badge>
          ))}
          <Badge className="bg-slate-100 text-slate-700">
            Recebidos: {trackings.filter((t) => t.received).length}/{trackings.length}
          </Badge>
        </div>
      )}

      {adding ? (
        <form ref={addRef} action={addAction} className="space-y-3 rounded-lg bg-slate-50 p-3">
          <Field label="Códigos de rastreio" hint="Cole um ou vários códigos (um por linha ou separados por espaço/vírgula).">
            <Textarea name="codes" rows={3} placeholder={"LZ469784745CN\nLZ468458427CN"} required />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Conteúdo / identificação (opcional)">
              <Input name="label" placeholder="Ex.: Internacional, Grêmio" />
            </Field>
            <Field label="Transportadora">
              <Input name="carrier" list="dl-carriers" defaultValue={defaultCarrier} />
            </Field>
            <Field label="Status inicial">
              <Select name="status" defaultValue="postado">
                <StatusOptions />
              </Select>
            </Field>
          </div>
          {addState?.error && <p className="text-sm text-red-600">{addState.error}</p>}
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={addPending}>
              {addPending ? "Adicionando..." : "Adicionar rastreios"}
            </button>
            {trackings.length > 0 && (
              <button type="button" className={btnSecondary} onClick={() => setAdding(false)}>
                Fechar
              </button>
            )}
          </div>
        </form>
      ) : (
        <button className={btnSecondary} onClick={() => setAdding(true)}>
          + Adicionar rastreios
        </button>
      )}

      {trackings.length > 0 && (
        <>
          <form
            action={async (fd) => {
              await bulkTrackingStatus(fd);
              setSelected(new Set());
            }}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm"
          >
            <input type="hidden" name="orderId" value={orderId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.size === trackings.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(trackings.map((t) => t.id)) : new Set())}
              />
              Todos
            </label>
            <span className="text-slate-500">{selected.size} selecionado(s) →</span>
            <Select name="status" className="w-auto" defaultValue="em_transito">
              <StatusOptions />
            </Select>
            <SubmitButton className={btnSmall} disabled={!selected.size} pendingText="Aplicando...">
              Aplicar status
            </SubmitButton>
          </form>

          <ul className="divide-y divide-slate-100">
            {trackings.map((t) => (
              <TrackingRow
                key={t.id}
                orderId={orderId}
                t={t}
                today={today}
                selected={selected.has(t.id)}
                onToggle={() => toggle(t.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TrackingRow({
  orderId,
  t,
  today,
  selected,
  onToggle,
}: {
  orderId: number;
  t: TrackingView;
  today: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const res = await updateTracking(orderId, prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);
  const [received, setReceived] = useState(t.received);

  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4" checked={selected} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={t.link} target="_blank" rel="noreferrer" className="font-mono text-sm font-medium text-blue-700 underline">
              {t.code}
            </a>
            <Badge className={TRACKING_STATUS_COLOR[t.status]}>{TRACKING_STATUS_LABEL[t.status]}</Badge>
            {t.received && <Badge className="bg-green-100 text-green-800">Recebido {fmtDate(t.receivedDate)}</Badge>}
          </div>
          <div className="text-xs text-slate-500">
            {[t.label, t.carrierName, t.taxBRL > 0 ? `Imposto pago ${fmtMoney(t.taxBRL)}` : null, t.notes]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <button className={btnSmall} onClick={() => setEditing((e) => !e)}>
          {editing ? "Fechar" : "Editar"}
        </button>
      </div>

      {editing && (
        <form action={action} className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="orderId" value={orderId} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Código">
              <Input name="code" defaultValue={t.code} />
            </Field>
            <Field label="Conteúdo">
              <Input name="label" defaultValue={t.label ?? ""} />
            </Field>
            <Field label="Transportadora">
              <Input name="carrier" list="dl-carriers" defaultValue={t.carrierName} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={t.status}>
                <StatusOptions />
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="received"
                checked={received}
                onChange={(e) => setReceived(e.target.checked)}
                className="size-4"
              />
              Pacote recebido
            </label>
            {received && (
              <Field label="Recebido em">
                <Input type="date" name="receivedDate" defaultValue={t.receivedDate ?? today} />
              </Field>
            )}
            <Field label="Observação" className={cx("col-span-2", received ? "sm:col-span-3" : "sm:col-span-4")}>
              <Input name="notes" defaultValue={t.notes ?? ""} />
            </Field>
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex justify-between gap-2">
            <button className={btnPrimary} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button
              formAction={deleteTracking}
              formNoValidate
              className="text-sm text-red-600 hover:underline"
              onClick={(e) => {
                if (!confirm(`Excluir o rastreio ${t.code}?`)) e.preventDefault();
              }}
            >
              Excluir rastreio
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
