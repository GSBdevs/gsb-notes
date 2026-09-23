/**
 * Renderiza o corpo de um lembrete com organização por "assuntos": linhas iniciadas por `*`, `-`
 * ou `•` viram itens de lista; o resto continua texto (com quebras preservadas). Herda cor e
 * tamanho do contexto (o pai define a tipografia), então serve tanto no disparo quanto na
 * visualização. Sem dependências de markdown — parsing mínimo e previsível.
 */

const BULLET_RE = /^\s*[*\-•]\s+(.*\S)\s*$/

type Block = { type: 'text'; text: string } | { type: 'list'; items: string[] }

function parseBody(text: string): Block[] {
  const blocks: Block[] = []
  for (const raw of text.split('\n')) {
    const m = raw.match(BULLET_RE)
    if (m) {
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'list') last.items.push(m[1])
      else blocks.push({ type: 'list', items: [m[1]] })
    } else {
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'text') last.text += '\n' + raw
      else blocks.push({ type: 'text', text: raw })
    }
  }
  // Remove blocos de texto totalmente vazios (linhas em branco entre listas, etc.).
  return blocks.filter((b) => (b.type === 'list' ? b.items.length > 0 : b.text.trim().length > 0))
}

export function ReminderBody({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseBody(text)
  if (blocks.length === 0) return null

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'list' ? (
          <ul key={i} className="flex flex-col gap-1.5">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span className="mt-[0.5em] h-1.5 w-1.5 flex-none rounded-full bg-current opacity-50" />
                <span className="min-w-0 flex-1">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {b.text.trim()}
          </p>
        ),
      )}
    </div>
  )
}
