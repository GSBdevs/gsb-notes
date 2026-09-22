import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { CHANGELOG, CURRENT_VERSION, unseenReleases, type Release } from '@/data/changelog'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

const LAST_SEEN_KEY = 'sb-notas.lastSeenVersion'

/** Evento p/ reabrir o modal manualmente (ex.: botão "Ver novidades" nos Ajustes). */
export const WHATS_NEW_EVENT = 'sbnotas:whats-new'

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}
function writeLastSeen(v: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, v)
  } catch {
    /* localStorage indisponível: sem persistência, o modal pode reaparecer */
  }
}

/** "2026-09-04" → "4 de setembro de 2026". */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Modal "Novidades": aparece automaticamente após uma atualização (quando a versão anunciada no
 * changelog muda em relação à última vista pelo usuário), listando o que mudou. Também abre sob
 * demanda pelo evento WHATS_NEW_EVENT (botão nos Ajustes) mostrando o histórico completo.
 * O conteúdo é editável em `src/data/changelog.ts`.
 */
export function WhatsNewModal() {
  const authed = useAppStore((s) => s.authed)
  const [releases, setReleases] = useState<Release[] | null>(null) // null = fechado

  // Auto: ao logar, compara a versão vista com a atual e mostra os releases novos.
  useEffect(() => {
    if (!authed) return
    const unseen = unseenReleases(readLastSeen())
    if (unseen.length > 0) setReleases(unseen)
  }, [authed])

  // Reabertura manual (Ajustes) → mostra o changelog completo.
  useEffect(() => {
    const onOpen = () => setReleases(CHANGELOG)
    window.addEventListener(WHATS_NEW_EVENT, onOpen)
    return () => window.removeEventListener(WHATS_NEW_EVENT, onOpen)
  }, [])

  if (!authed || !releases || releases.length === 0) return null

  const close = () => {
    writeLastSeen(CURRENT_VERSION) // marca como visto (não reaparece até a próxima versão)
    setReleases(null)
  }

  const footer = (
    <>
      <div className="flex-1" />
      <button
        onClick={close}
        className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
      >
        <Icon name="check" size={16} /> Entendi
      </button>
    </>
  )

  return (
    <Modal title="Novidades" onClose={close} maxWidth={520} footer={footer}>
      <div className="flex flex-col gap-6 p-5">
        {releases.map((r, i) => (
          <section key={r.version}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-accent-surface text-accent-ink">
                <Icon name="sparkles" size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-bold tracking-[-.01em]">
                    {r.title ?? `Versão ${r.version}`}
                  </h3>
                  <span className="rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                    v{r.version}
                  </span>
                  {i === 0 && (
                    <span className="rounded-full bg-accent-surface px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                      Nova
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-text-muted">{formatDate(r.date)}</div>
              </div>
            </div>
            <ul className="flex flex-col gap-2 pl-1">
              {r.changes.map((c, j) => (
                <li key={j} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-text-secondary">
                  <Icon
                    name="check"
                    size={13}
                    strokeWidth={3}
                    className="mt-1 flex-none"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
