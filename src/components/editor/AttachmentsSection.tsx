import { useRef } from 'react'
import { useAddAttachment, useAttachments, useDeleteAttachment } from '@/hooks/useAttachments'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@/components/ui/Icon'

const MAX_MB = 10

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Anexos de um lembrete (editor, modo edição). Arquivos no Storage; imagem ganha miniatura. */
export function AttachmentsSection({ noteId }: { noteId: string }) {
  const { data: attachments = [], isLoading } = useAttachments(noteId)
  const add = useAddAttachment()
  const del = useDeleteAttachment()
  const showToast = useAppStore((s) => s.showToast)
  const inputRef = useRef<HTMLInputElement>(null)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reanexar o mesmo arquivo
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      showToast(`Arquivo muito grande (máx. ${MAX_MB} MB)`)
      return
    }
    try {
      await add.mutateAsync({ noteId, file })
    } catch {
      showToast('Não foi possível anexar. Tente de novo.')
    }
  }

  /**
   * Baixa o anexo. O signed URL do Storage é CROSS-ORIGIN, então o atributo `download` de um <a>
   * é ignorado pelo navegador (abre inline em vez de baixar). Solução: buscar os bytes e salvar via
   * um blob mesma-origem (aí o `download` + nome valem). Fallback: forçar Content-Disposition no
   * servidor (param `download=`) e abrir — cobre o caso de CORS bloquear o fetch.
   */
  const onDownload = async (a: { url: string; name: string }) => {
    try {
      const res = await fetch(a.url)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = objUrl
      el.download = a.name
      document.body.appendChild(el)
      el.click()
      el.remove()
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
    } catch {
      const sep = a.url.includes('?') ? '&' : '?'
      const forced = `${a.url}${sep}download=${encodeURIComponent(a.name)}`
      if (!window.open(forced, '_blank')) showToast('Não foi possível baixar o anexo.')
    }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <Icon name="paperclip" size={15} />
        Anexos {attachments.length > 0 && <span className="text-text-muted">· {attachments.length}</span>}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={add.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-base px-2.5 text-[12.5px] font-semibold text-text-primary transition-colors hover:border-border-strong disabled:opacity-50"
        >
          {add.isPending ? <Icon name="loader-2" size={14} className="animate-spin" /> : <Icon name="plus" size={14} />}
          Anexar
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
      </div>

      <div className="flex flex-col gap-1.5">
        {attachments.map((a) => {
          const isImage = a.mime.startsWith('image/') && !!a.url
          return (
            <div
              key={a.id}
              className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-2.5 py-2"
            >
              {isImage ? (
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-9 w-9 flex-none rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="grid h-9 w-9 flex-none place-items-center rounded bg-bg-elevated-2 text-text-secondary">
                  <Icon name="file" size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{a.name}</div>
                <div className="text-[11.5px] text-text-muted">{humanSize(a.size)}</div>
              </div>
              {a.url && (
                <button
                  type="button"
                  onClick={() => onDownload(a)}
                  title="Baixar"
                  aria-label={`Baixar ${a.name}`}
                  className="grid h-7 w-7 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text-primary"
                >
                  <Icon name="download" size={15} />
                </button>
              )}
              {a.mine && (
                <button
                  onClick={() => del.mutate({ id: a.id, noteId })}
                  aria-label={`Apagar ${a.name}`}
                  title="Apagar"
                  className="grid h-7 w-7 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-danger"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          )
        })}
        {!isLoading && attachments.length === 0 && (
          <p className="text-[13px] text-text-muted">Nenhum anexo. Use “Anexar” para adicionar arquivos.</p>
        )}
      </div>
    </div>
  )
}
