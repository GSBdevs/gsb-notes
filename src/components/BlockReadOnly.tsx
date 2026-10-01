import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import type { PartialBlock } from '@blocknote/core'
import { pt } from '@blocknote/core/locales'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { useAppStore } from '@/store/useAppStore'

/**
 * Render SOMENTE-LEITURA do conteúdo de um bloco (BlockNote), para o resumo de quem só pode ver.
 * Mesmo motor do editor, com `editable={false}` — sem a casca do editor (cabeçalho/salvar). Carregado
 * sob demanda (React.lazy) para o BlockNote não entrar no bundle principal. Default export p/ o lazy.
 */
export default function BlockReadOnly({ content }: { content?: unknown[] | null }) {
  const themePref = useAppStore((s) => s.settings.theme)
  const editor = useCreateBlockNote({
    dictionary: pt,
    initialContent:
      Array.isArray(content) && content.length ? (content as unknown as PartialBlock[]) : undefined,
  })
  const bnTheme: 'light' | 'dark' =
    themePref === 'light'
      ? 'light'
      : themePref === 'dark'
        ? 'dark'
        : window.matchMedia?.('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
  return <BlockNoteView editor={editor} editable={false} theme={bnTheme} />
}
