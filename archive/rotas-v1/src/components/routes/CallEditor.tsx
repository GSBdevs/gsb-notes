import { useState, type ReactNode } from 'react'
import type { ReminderDraft, ServiceCall, TonerLevels } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useCreateReminder, useDeleteReminder, useSetStatus, useUpdateReminder } from '@/hooks/useReminders'
import { emptyCall, useSaveServiceCall, type CallItem } from '@/hooks/useServiceCalls'
import { geocode, lookupCep, type LatLon } from '@/services/geoService'
import { CALL_TYPES, intOrNull } from '@/lib/routes'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { ChecklistSection } from '@/components/editor/ChecklistSection'
import { AttachmentsSection } from '@/components/editor/AttachmentsSection'
import { PinPicker } from './RouteMap'
import { AutoTextarea } from '@/components/ui/AutoTextarea'

/** Quem pode ser técnico de um chamado (eu + contatos). */
export interface Technician {
  userId: string
  name: string
  color: string
}

const INPUT =
  'h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-strong'
const BTN_GHOST =
  'inline-flex h-10 flex-none items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50'

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-medium text-text-muted">{label}</span>
      {children}
    </label>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[.06em] text-text-muted">
        <Icon name={icon} size={14} /> {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Editor de chamado técnico (Rotas — teste, master). Uma nota kind 'call' (título, observações,
 * checklist, anexos) + os dados de `service_calls` (local, técnico, dia, campos de MPS). Endereço vira
 * coordenada só ao pedir/salvar (Nominatim); o pin pode ser ajustado à mão no mini-mapa.
 */
export function CallEditor({
  item,
  defaults,
  technicians,
  nextPosition,
  onClose,
}: {
  /** null = chamado novo. */
  item: CallItem | null
  defaults: { scheduledDate: string | null; technicianId: string | null }
  technicians: Technician[]
  /** Próxima posição livre na rota (técnico + dia) — chamado novo ou movido de rota vai para o fim. */
  nextPosition: (technicianId: string | null, day: string | null) => number
  onClose: () => void
}) {
  const showToast = useAppStore((s) => s.showToast)
  const routeBase = useAppStore((s) => s.routeBase)
  const create = useCreateReminder()
  const update = useUpdateReminder()
  const saveCall = useSaveServiceCall()
  const setStatus = useSetStatus()
  const del = useDeleteReminder()

  const note = item?.note ?? null
  const isNew = !note
  const canEdit = !note || note.mine || note.myShare === 'edit'
  const done = note?.status === 'archived'

  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [newItems, setNewItems] = useState('')
  const [call, setCall] = useState<ServiceCall>(
    () =>
      item?.call ?? {
        ...emptyCall(''),
        scheduledDate: defaults.scheduledDate,
        technicianId: defaults.technicianId,
      },
  )
  const [busy, setBusy] = useState<null | 'cep' | 'geo' | 'save'>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const patch = (p: Partial<ServiceCall>) => setCall((c) => ({ ...c, ...p }))
  const patchToner = (k: keyof TonerLevels, v: string) =>
    setCall((c) => ({ ...c, toner: { k: null, c: null, m: null, y: null, ...(c.toner ?? {}), [k]: intOrNull(v) } }))
  const loc: LatLon | null = call.lat != null && call.lon != null ? { lat: call.lat, lon: call.lon } : null

  const onCep = async () => {
    setBusy('cep')
    try {
      const r = await lookupCep(call.cep ?? '')
      if (!r) return showToast('CEP não encontrado')
      const addr = [r.street, r.district, `${r.city} - ${r.uf}`].filter(Boolean).join(', ')
      patch({ address: addr, lat: null, lon: null, geoSource: null })
      showToast('Endereço preenchido — complete com o número')
    } catch {
      showToast('Não foi possível consultar o CEP')
    } finally {
      setBusy(null)
    }
  }

  /** Geocodifica o endereço atual. Devolve as coordenadas (ou null) para o fluxo de salvar. */
  const locate = async (silent = false): Promise<LatLon | null> => {
    if (!call.address.trim()) return null
    setBusy('geo')
    try {
      const q = [call.address, call.cep].filter(Boolean).join(', ')
      const p = await geocode(q)
      if (p) patch({ lat: p.lat, lon: p.lon, geoSource: 'nominatim' })
      else if (!silent) showToast('Endereço não localizado — marque no mapa')
      return p
    } catch {
      if (!silent) showToast('Falha ao localizar o endereço')
      return null
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!call.customer.trim() && !title.trim()) return showToast('Informe o cliente ou o resumo')
    setBusy('save')
    try {
      // Geocodifica só ao salvar (política do Nominatim) e só se ainda não houver coordenada.
      let coords = loc
      if (!coords && call.address.trim()) {
        coords = await locate(true)
        setBusy('save')
      }
      const finalTitle = title.trim() || call.customer.trim()
      const draft: ReminderDraft = {
        mode: isNew ? 'new' : 'edit',
        id: note?.id ?? null,
        title: finalTitle,
        body,
        color: note?.color ?? '#FACC15',
        priority: note?.priority ?? 'normal',
        pinned: note?.pinned ?? false,
        remindAt: null,
        recurrence: 'once',
        recurrenceRule: null,
        shares: note?.shares ?? [],
        tags: note?.tags ?? [],
        workspaceId: note?.workspaceId ?? null,
        kind: 'call',
        checklist: isNew
          ? newItems
              .split('\n')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((text) => ({ text, done: false }))
          : (note?.checklist ?? []),
        ownedByMe: note?.mine ?? true,
        autoSnooze: false,
        snoozeIntervalMin: note?.snoozeIntervalMin ?? 10,
      }
      const saved = isNew ? await create.mutateAsync(draft) : await update.mutateAsync({ id: note!.id, draft })
      // Mudou de rota (técnico ou dia) → vai para o fim da nova rota.
      const movedRoute =
        isNew || item!.call.technicianId !== call.technicianId || item!.call.scheduledDate !== call.scheduledDate
      await saveCall.mutateAsync({
        ...call,
        noteId: saved.id,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        geoSource: coords ? (call.geoSource ?? 'nominatim') : null,
        routePosition: movedRoute ? nextPosition(call.technicianId, call.scheduledDate) : call.routePosition,
      })
      showToast(isNew ? 'Chamado criado' : 'Chamado salvo')
      onClose()
    } catch {
      showToast('Não foi possível salvar o chamado')
    } finally {
      setBusy(null)
    }
  }

  const toggleDone = () => {
    if (!note) return
    setStatus.mutate({ id: note.id, status: done ? 'active' : 'archived' })
    showToast(done ? 'Chamado reaberto' : 'Chamado concluído')
    onClose()
  }

  const onDelete = () => {
    if (!note) return
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3500)
      return
    }
    del.mutate(note.id)
    showToast('Chamado excluído')
    onClose()
  }

  const footer = (
    <>
      {note?.mine && (
        <button
          onClick={onDelete}
          className={`inline-flex h-[42px] items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors ${
            confirmDel
              ? 'border-danger bg-[#ef44441a] text-danger'
              : 'border-border bg-transparent text-text-secondary hover:border-danger hover:text-danger'
          }`}
        >
          <Icon name={confirmDel ? 'check' : 'trash-2'} size={15} />
          {confirmDel ? 'Confirmar?' : 'Excluir'}
        </button>
      )}
      <div className="flex-1" />
      {note && canEdit && (
        <button
          onClick={toggleDone}
          className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong"
        >
          <Icon name={done ? 'rotate-ccw' : 'check'} size={15} /> {done ? 'Reabrir' : 'Concluir'}
        </button>
      )}
      {canEdit && (
        <button
          onClick={save}
          disabled={busy !== null}
          className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {busy === 'save' ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="check" size={15} />}
          Salvar
        </button>
      )}
    </>
  )

  return (
    <Modal title={isNew ? 'Novo chamado' : 'Chamado'} onClose={onClose} maxWidth={640} footer={footer}>
      <fieldset disabled={!canEdit} className="flex flex-col gap-6 p-5">
        <Section title="Chamado" icon="printer">
          <Field label="Cliente / local">
            <input
              className={INPUT}
              value={call.customer}
              onChange={(e) => patch({ customer: e.target.value })}
              placeholder="Ex.: Escola Municipal X — Secretaria"
              autoFocus={isNew}
            />
          </Field>
          <Field label="Resumo do problema / serviço">
            <input
              className={INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Atolamento de papel na bandeja 2"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select
                className={INPUT}
                value={call.callType}
                onChange={(e) => patch({ callType: e.target.value as ServiceCall['callType'] })}
              >
                {CALL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tempo estimado no local (min)">
              <input
                className={INPUT}
                type="number"
                min={0}
                step={5}
                value={call.estMinutes}
                onChange={(e) => patch({ estMinutes: Math.max(0, intOrNull(e.target.value) ?? 0) })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Rota" icon="route">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Dia">
              <input
                className={INPUT}
                type="date"
                value={call.scheduledDate ?? ''}
                onChange={(e) => patch({ scheduledDate: e.target.value || null })}
              />
            </Field>
            <Field label="Técnico">
              <select
                className={INPUT}
                value={call.technicianId ?? ''}
                onChange={(e) => patch({ technicianId: e.target.value || null })}
              >
                <option value="">Sem técnico</option>
                {technicians.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!call.scheduledDate && (
            <p className="-mt-1 text-[12px] text-text-muted">Sem dia, o chamado fica em “A agendar”.</p>
          )}
        </Section>

        <Section title="Local" icon="map-pin">
          <div className="flex gap-2">
            <input
              className={`${INPUT} max-w-[160px]`}
              inputMode="numeric"
              value={call.cep ?? ''}
              onChange={(e) => patch({ cep: e.target.value || null })}
              placeholder="CEP"
            />
            <button type="button" onClick={onCep} disabled={busy !== null || !call.cep} className={BTN_GHOST}>
              {busy === 'cep' ? <Icon name="loader-2" size={14} className="animate-spin" /> : <Icon name="search" size={14} />}
              Buscar CEP
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className={INPUT}
              value={call.address}
              onChange={(e) => patch({ address: e.target.value, lat: null, lon: null, geoSource: null })}
              placeholder="Rua, número, bairro, cidade - UF"
            />
            <button
              type="button"
              onClick={() => void locate()}
              disabled={busy !== null || !call.address.trim()}
              className={BTN_GHOST}
            >
              {busy === 'geo' ? <Icon name="loader-2" size={14} className="animate-spin" /> : <Icon name="map-pin" size={14} />}
              Localizar
            </button>
          </div>
          <div className="h-[220px] overflow-hidden rounded-md border border-border">
            <PinPicker
              value={loc}
              fallbackCenter={routeBase}
              onChange={(p) => canEdit && patch({ lat: p.lat, lon: p.lon, geoSource: 'manual' })}
            />
          </div>
          <p className="-mt-1 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Icon name={loc ? 'check-circle' : 'alert-triangle'} size={12} />
            {loc
              ? call.geoSource === 'manual'
                ? 'Localização ajustada à mão.'
                : 'Localizado pelo endereço — arraste o pin se não estiver exato.'
              : 'Sem localização: use “Localizar” ou clique no mapa. Fica fora do traçado até ter.'}
          </p>
        </Section>

        <Section title="Equipamento" icon="printer">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Modelo">
              <input
                className={INPUT}
                value={call.equipment ?? ''}
                onChange={(e) => patch({ equipment: e.target.value || null })}
                placeholder="Ex.: Brother DCP-L5652DN"
              />
            </Field>
            <Field label="Nº de série">
              <input
                className={INPUT}
                value={call.serialNumber ?? ''}
                onChange={(e) => patch({ serialNumber: e.target.value || null })}
              />
            </Field>
            <Field label="Medidor P&B">
              <input
                className={INPUT}
                type="number"
                min={0}
                value={call.meterBw ?? ''}
                onChange={(e) => patch({ meterBw: intOrNull(e.target.value) })}
              />
            </Field>
            <Field label="Medidor colorido">
              <input
                className={INPUT}
                type="number"
                min={0}
                value={call.meterColor ?? ''}
                onChange={(e) => patch({ meterColor: intOrNull(e.target.value) })}
              />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-text-muted">Toner (%)</span>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['k', 'Preto'],
                  ['c', 'Ciano'],
                  ['m', 'Magenta'],
                  ['y', 'Amarelo'],
                ] as const
              ).map(([k, label]) => (
                <input
                  key={k}
                  className={INPUT}
                  type="number"
                  min={0}
                  max={100}
                  aria-label={`Toner ${label}`}
                  placeholder={label}
                  value={call.toner?.[k] ?? ''}
                  onChange={(e) => patchToner(k, e.target.value)}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Checklist" icon="list-todo">
          {isNew ? (
            <AutoTextarea
              className={`${INPUT} h-auto min-h-[88px] resize-none py-2.5`}
              value={newItems}
              onChange={(e) => setNewItems(e.target.value)}
              placeholder={'Um item por linha. Ex.:\nTrocar rolo de tração\nLimpar fusor\nTestar impressão'}
            />
          ) : (
            <ChecklistSection reminder={note!} canEdit={canEdit} />
          )}
        </Section>

        <Section title="Observações" icon="pencil">
          <AutoTextarea
            className={`${INPUT} h-auto min-h-[80px] resize-none py-2.5`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Contato no local, horário de atendimento, histórico…"
          />
        </Section>
      </fieldset>

      {note && (
        <div className="px-5 pb-5">
          <AttachmentsSection noteId={note.id} />
        </div>
      )}
    </Modal>
  )
}
