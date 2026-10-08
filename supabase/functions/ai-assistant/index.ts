// Edge Function: ai-assistant
// Ferramenta de IA (teste, SÓ MASTER). A IA NUNCA grava nada — sempre devolve uma proposta/ação que o
// app aplica pelo fluxo normal (notesService), com confirmação do usuário. Modos (campo `mode`):
//   • create    (default): texto livre → PROPOSTA estruturada de lembrete → pré-preenche o editor.
//   • chat:      conversa multi-turno → refina a proposta ("não, deixa pra terça") antes do editor.
//   • edit:      instrução + lista de itens → identifica o item e devolve SÓ os campos que mudam.
//   • summarize: lista de itens → RESUMO organizado em texto (só leitura).
//   • organize:  lista de itens → resumo + AÇÕES concretas (repriorizar/agendar) aplicáveis 1 a 1.
//   • search:    pergunta aberta → resposta com FONTES via Google Search (grounding). Só a pergunta.
// A chave do provedor fica aqui (secret no servidor), nunca no app.
//
// Provedor: Gemini (free tier) via REST generateContent. Otimização: modos estruturados/curtos usam
// GEMINI_MODEL_FAST (se setado) + maxOutputTokens; só o search usa o modelo principal (grounding).
//
// Deploy (uma vez, pelo dono):
//   supabase secrets set GEMINI_API_KEY=xxxx
//     (opcional: GEMINI_MODEL, GEMINI_MODEL_FAST, GEMINI_MODEL_FALLBACK)
//   supabase functions deploy ai-assistant
//
// Sem dependências npm de propósito: a validação do JWT e a checagem de papel são feitas via REST
// (fetch) nas APIs do próprio Supabase. Importar `@supabase/supabase-js` arrastava `realtime-js` e
// quebrava o bundle quando um tarball transitivo sumia do registro npm.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
// gemini-2.0-flash foi descontinuado (404 "no longer available"); a própria API indica o gemini-3.8-flash.
// Dá para sobrepor sem redeploy: `supabase secrets set GEMINI_MODEL=<modelo>`.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
// Modelo rápido p/ os modos curtos/estruturados (ex.: um flash-lite). Vazio = usa o principal.
const GEMINI_MODEL_FAST = (Deno.env.get('GEMINI_MODEL_FAST') ?? '').trim()

/** Valida o JWT do chamador via GoTrue (/auth/v1/user) e devolve o user id, ou null. */
async function getUserId(token: string): Promise<string | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY },
    })
    if (!r.ok) return null
    const u = await r.json().catch(() => null)
    return typeof u?.id === 'string' ? u.id : null
  } catch {
    return null
  }
}

/** Lê o papel global do usuário via PostgREST com a service_role (ignora RLS). */
async function getRole(uid: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(uid)}&select=role&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    )
    if (!r.ok) return null
    const rows = await r.json().catch(() => null)
    return Array.isArray(rows) && rows[0]?.role ? String(rows[0].role) : null
  } catch {
    return null
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

// ── Normalização (compartilhada; bate com os tipos do app em src/types.ts) ────
const PRIO = ['normal', 'important', 'urgent']
const RECUR = ['once', 'daily', 'weekly', 'monthly']
/** Prioridade válida ou '' (= sem valor/sem mudança). */
const normPriority = (v: unknown) => (PRIO.includes(v as string) ? (v as string) : '')
const normRecur = (v: unknown) => (RECUR.includes(v as string) ? (v as string) : '')
/** ISO válido ou null. */
const normIso = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s && !Number.isNaN(Date.parse(s)) ? s : null
}
/** Proposta de lembrete a partir do JSON do modelo (usada no create e no chat). */
// deno-lint-ignore no-explicit-any
const toProposal = (p: any) => ({
  title: String(p?.title ?? '').slice(0, 200),
  body: String(p?.body ?? '').slice(0, 4000),
  remindAt: normIso(p?.remindAt),
  priority: normPriority(p?.priority) || 'normal',
  recurrence: normRecur(p?.recurrence) || 'once',
  tags: Array.isArray(p?.tags)
    ? (p.tags as unknown[]).filter((t) => typeof t === 'string').slice(0, 3).map((t) => String(t))
    : [],
})

// ── Prompts ───────────────────────────────────────────────────────────────────
const SYSTEM_CREATE = `Você é o assistente do SB Notas, um app de lembretes em português (pt-BR).
A partir do pedido do usuário, produza UMA proposta de lembrete. Regras:
- "title": curto e direto (o que lembrar). Nunca vazio.
- "body": detalhes extras, ou "" se não houver.
- "remindAt": data/hora do disparo em ISO 8601 COM offset (ex.: 2026-10-05T14:00:00-03:00).
  Resolva expressões relativas ("amanhã", "sexta 14h", "daqui a 2h") em relação ao AGORA informado.
  Se o pedido não tiver quando, devolva "" (vazio).
- "priority": "urgent" só se o usuário indicar urgência/"urgente"; "important" se der ênfase; senão "normal".
- "recurrence": "daily"/"weekly"/"monthly" se o pedido for recorrente; senão "once".
- "tags": até 3 etiquetas curtas em minúsculas, ou [] se não fizer sentido.
Responda SOMENTE o objeto pedido, sem comentários.`

const SYSTEM_CHAT = `Você é o assistente do SB Notas (pt-BR), ajudando a montar UM lembrete numa conversa.
A cada mensagem, atualize a proposta com o que já se sabe e peça o que faltar.
- "reply": resposta curta e natural ao usuário (1-2 frases). Peça esclarecimento se precisar.
- Campos da proposta (title/body/remindAt/priority/recurrence/tags): mesmas regras do assistente de
  criação. Use o AGORA para datas relativas. Se ainda não souber o título, deixe "title" vazio.
Responda SOMENTE o objeto pedido.`

const SYSTEM_EDIT = `Você é o assistente do SB Notas (pt-BR). O usuário quer ALTERAR um item existente.
Recebe a lista de itens (cada um com "id") e uma instrução. Escolha o item que a instrução indica e
devolva "targetId" = o id EXATO da lista, mais SÓ os campos que mudam ("" nos que não mudam):
- "remindAt": ISO 8601 com offset, resolvendo datas relativas pelo AGORA; "" se não muda.
- "priority": normal|important|urgent; "" se não muda.
- "recurrence": once|daily|weekly|monthly; "" se não muda.
- "title": novo título; "" se não muda.
- "note": frase curta do que você entendeu (ex.: "Adiei 'Reunião' para sexta às 14h").
Se nenhum item corresponder com clareza, devolva "targetId" vazio e explique em "note".`

const SYSTEM_ORGANIZE = `Você é o assistente do SB Notas (pt-BR). Recebe os itens ATIVOS (cada um com
"id") e devolve:
- "summary": resumo curto e organizado, sem markdown (nada de #, *, **).
- "actions": até 6 AÇÕES concretas e úteis, cada uma apontando um item ("targetId" = id EXATO) e
  propondo mudança de "priority" (normal|important|urgent) e/ou "remindAt" (ISO com offset). Use "" no
  campo que a ação NÃO altera. "label": texto curto e claro (ex.: "Agendar 'Pagar luz' para hoje 18h").
  Só proponha ações que façam sentido (dar horário a item sem data; subir prioridade de algo atrasado).
Não invente itens que não estejam na lista.`

const SYSTEM_SEARCH = `Você é o assistente do SB Notas (pt-BR). Responda à pergunta do usuário de
forma objetiva e correta, em português, usando os resultados da busca. Seja conciso (poucos
parágrafos). Se a busca não trouxer resposta confiável, diga que não encontrou. Não invente fatos
nem fontes. NÃO use markdown (nada de #, *, **).`

const SYSTEM_SUMMARY = `Você é o assistente do SB Notas (pt-BR). Recebe a lista de itens do usuário
(lembretes e tarefas) e devolve um RESUMO organizado e acionável. Regras:
- NÃO invente itens que não estejam na lista.
- Priorize: atrasados e de hoje primeiro, depois urgentes/importantes, depois o restante.
- Para tarefas, considere o progresso (feitos/total).
- Termine com uma linha curta sugerindo por onde começar.
- NÃO use markdown (nada de #, *, **). Separe seções com um título curto em MAIÚSCULAS numa linha e
  itens começando com "- ".
- Seja conciso: no máximo ~200 palavras.`

// ── Schemas (saída estruturada) ───────────────────────────────────────────────
const PROPOSAL_PROPS = {
  title: { type: 'STRING' },
  body: { type: 'STRING' },
  remindAt: { type: 'STRING' },
  priority: { type: 'STRING' },
  recurrence: { type: 'STRING' },
  tags: { type: 'ARRAY', items: { type: 'STRING' } },
}
const SCHEMA_CREATE = { type: 'OBJECT', properties: PROPOSAL_PROPS, required: ['title'] }
const SCHEMA_CHAT = { type: 'OBJECT', properties: { reply: { type: 'STRING' }, ...PROPOSAL_PROPS }, required: ['reply'] }
const SCHEMA_EDIT = {
  type: 'OBJECT',
  properties: {
    targetId: { type: 'STRING' },
    title: { type: 'STRING' },
    remindAt: { type: 'STRING' },
    priority: { type: 'STRING' },
    recurrence: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['targetId'],
}
const SCHEMA_ORGANIZE = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          targetId: { type: 'STRING' },
          label: { type: 'STRING' },
          priority: { type: 'STRING' },
          remindAt: { type: 'STRING' },
        },
        required: ['targetId', 'label'],
      },
    },
  },
  required: ['summary'],
}

/** Modelos a tentar: principal (ou o rápido, p/ modos curtos) + reserva opcional. */
function modelsFor(fast: boolean): string[] {
  const primary = fast && GEMINI_MODEL_FAST ? GEMINI_MODEL_FAST : GEMINI_MODEL
  const fb = (Deno.env.get('GEMINI_MODEL_FALLBACK') ?? '').trim()
  // No search (fast=false) o modelo rápido entra como ÚLTIMO recurso — se o principal e o reserva
  // estiverem sobrecarregados (503), ainda há uma chance de responder em vez de falhar.
  const extra = !fast ? GEMINI_MODEL_FAST : ''
  return [...new Set([primary, fb, extra].filter(Boolean))]
}

/**
 * Chama o Gemini com retry+backoff para 429/500/502/503 e modelo de reserva opcional. `fast` escolhe
 * o modelo rápido quando houver. Retorna o JSON cru (data) ou o último status/detalhe de erro.
 */
// deno-lint-ignore no-explicit-any
async function callGemini(payload: string, fast = false): Promise<{ data: any; status: number; detail: string }> {
  const models = modelsFor(fast)
  const RETRIABLE = new Set([429, 500, 502, 503])
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  // deno-lint-ignore no-explicit-any
  let data: any = null
  let status = 0
  let detail = ''
  outer: for (const model of models) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
    for (let attempt = 0; attempt < 3; attempt++) {
      let resp: Response
      try {
        resp = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload })
      } catch (e) {
        status = 0
        detail = e instanceof Error ? e.message : String(e)
        await sleep(400 * (attempt + 1) * (attempt + 1)) // backoff p/ falha de rede
        continue
      }
      if (resp.ok) {
        data = await resp.json().catch(() => null)
        break outer
      }
      status = resp.status
      detail = (await resp.text().catch(() => '')).slice(0, 500)
      if (RETRIABLE.has(resp.status) && attempt < 2) {
        await sleep(400 * (attempt + 1) * (attempt + 1)) // 400ms, 1600ms
        continue
      }
      break // erro não-retriável neste modelo → tenta o próximo (se houver)
    }
  }
  return { data, status, detail }
}

/** Resposta de falha padronizada: 503 sobrecarregado (retryable) ou 502 genérico. */
const failResponse = (status: number, detail: string) =>
  status === 503 || status === 429
    ? json({ error: 'O modelo está sobrecarregado agora. Tente de novo em instantes.', retryable: true }, 503)
    : json({ error: `IA indisponível (status ${status || 'rede'})`, detail }, 502)

const rawText = (data: unknown): string =>
  // deno-lint-ignore no-explicit-any
  ((data as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string

/** Extrai e faz parse do JSON de saída estruturada; tolera cercas ```json e texto em volta. */
const parseJson = (data: unknown): Record<string, unknown> | null => {
  let raw = rawText(data).trim()
  if (!raw) return null
  // Remove cercas de código, se o modelo as adicionar.
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    /* tenta extrair o objeto do primeiro { ao último } */
  }
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(raw.slice(s, e + 1))
    } catch {
      /* desiste */
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // 1) Identifica quem chamou pelo JWT do header.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'sem token' }, 401)
  const uid = await getUserId(token)
  if (!uid) return json({ error: 'token inválido' }, 401)

  // 2) Confirma que o chamador é MASTER (ferramenta de teste — só o master usa).
  const role = await getRole(uid)
  if (role !== 'master') return json({ error: 'apenas o master pode usar o assistente' }, 403)

  // 3) Entrada.
  let body: {
    prompt?: string
    nowIso?: string
    tz?: string
    mode?: string
    items?: unknown[]
    messages?: { role?: string; text?: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const nowIso = (body.nowIso ?? new Date().toISOString()).trim()
  const tz = (body.tz ?? 'America/Sao_Paulo').trim()
  const mode = ['summarize', 'search', 'edit', 'organize', 'chat'].includes(body.mode ?? '')
    ? (body.mode as string)
    : 'create'
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY não configurada no servidor' }, 500)

  // ── SUMMARIZE: resume/organiza a lista de itens (texto, só leitura) ──
  if (mode === 'summarize') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 80) : []
    if (items.length === 0) return json({ error: 'nada para resumir' }, 400)
    const focus = (body.prompt ?? '').trim().slice(0, 500)
    const userText =
      `AGORA: ${nowIso} (fuso ${tz}).\nFoco do usuário: ${focus || 'resumo geral'}\n` +
      `Itens (JSON): ${JSON.stringify(items).slice(0, 12000)}`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_SUMMARY }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
    })
    const { data, status, detail } = await callGemini(payload, true)
    if (data == null) return failResponse(status, detail)
    const summary = rawText(data).trim()
    if (!summary) return json({ error: 'a IA não retornou um resumo' }, 502)
    return json({ ok: true, summary })
  }

  // ── ORGANIZE: resumo + ações concretas (repriorizar/agendar) aplicáveis 1 a 1 com confirmação ──
  if (mode === 'organize') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 80) : []
    if (items.length === 0) return json({ error: 'nada para organizar' }, 400)
    const focus = (body.prompt ?? '').trim().slice(0, 500)
    const userText =
      `AGORA: ${nowIso} (fuso ${tz}).\nFoco do usuário: ${focus || 'organização geral'}\n` +
      `Itens (JSON): ${JSON.stringify(items).slice(0, 12000)}`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_ORGANIZE }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_ORGANIZE,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    })
    const { data, status, detail } = await callGemini(payload, true)
    if (data == null) return failResponse(status, detail)
    const parsed = parseJson(data)
    if (!parsed) return json({ error: 'resposta da IA ilegível' }, 502)
    const summary = String(parsed.summary ?? '').trim()
    const rawActions = Array.isArray(parsed.actions) ? parsed.actions : []
    const actions: { targetId: string; label: string; patch: Record<string, unknown> }[] = []
    for (const a of rawActions.slice(0, 6)) {
      // deno-lint-ignore no-explicit-any
      const aa = a as any
      const targetId = String(aa?.targetId ?? '').trim()
      if (!targetId) continue
      const patch: Record<string, unknown> = {}
      const p = normPriority(aa?.priority)
      if (p) patch.priority = p
      const ra = normIso(aa?.remindAt)
      if (ra) patch.remindAt = ra
      if (Object.keys(patch).length === 0) continue
      actions.push({ targetId, label: String(aa?.label ?? 'Aplicar').slice(0, 120), patch })
    }
    return json({ ok: true, summary, actions })
  }

  // ── EDIT: instrução + itens → identifica o item e devolve só os campos que mudam ──
  if (mode === 'edit') {
    const instruction = (body.prompt ?? '').trim()
    if (!instruction) return json({ error: 'diga o que mudar' }, 400)
    const items = Array.isArray(body.items) ? body.items.slice(0, 80) : []
    if (items.length === 0) return json({ error: 'nenhum item para editar' }, 400)
    const userText =
      `AGORA: ${nowIso} (fuso ${tz}).\nInstrução: ${instruction}\n` +
      `Itens (JSON): ${JSON.stringify(items).slice(0, 12000)}`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_EDIT }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_EDIT,
        temperature: 0.1,
        maxOutputTokens: 600,
      },
    })
    const { data, status, detail } = await callGemini(payload, true)
    if (data == null) return failResponse(status, detail)
    const parsed = parseJson(data)
    if (!parsed) return json({ error: 'resposta da IA ilegível' }, 502)
    const targetId = String(parsed.targetId ?? '').trim()
    const patch: Record<string, unknown> = {}
    const t = String(parsed.title ?? '').trim()
    if (t) patch.title = t.slice(0, 200)
    const ra = normIso(parsed.remindAt)
    if (ra) patch.remindAt = ra
    const p = normPriority(parsed.priority)
    if (p) patch.priority = p
    const rc = normRecur(parsed.recurrence)
    if (rc) patch.recurrence = rc
    return json({ ok: true, edit: { targetId, patch, note: String(parsed.note ?? '').slice(0, 200) } })
  }

  // ── CHAT: conversa multi-turno → proposta refinada ──
  if (mode === 'chat') {
    const msgs = Array.isArray(body.messages) ? body.messages : []
    const contents = msgs
      .slice(-12)
      .map((m) => ({
        role: m?.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m?.text ?? '').slice(0, 2000) }],
      }))
      .filter((c) => c.parts[0].text)
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      return json({ error: 'envie uma mensagem' }, 400)
    }
    // O AGORA (p/ datas relativas) vai na systemInstruction — não como turno, para não quebrar a
    // alternância user/model que alguns modelos exigem.
    const sysChat = `${SYSTEM_CHAT}\n\n(contexto) AGORA: ${nowIso} (fuso ${tz}).`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: sysChat }] },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_CHAT,
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    })
    const { data, status, detail } = await callGemini(payload, true)
    if (data == null) return failResponse(status, detail)
    const parsed = parseJson(data)
    if (!parsed) return json({ error: 'resposta da IA ilegível' }, 502)
    return json({ ok: true, reply: String(parsed.reply ?? '').slice(0, 1000), proposal: toProposal(parsed) })
  }

  // ── SEARCH: pergunta aberta respondida com Google Search (grounding). Só a pergunta trafega. ──
  if (mode === 'search') {
    const q = (body.prompt ?? '').trim()
    if (!q) return json({ error: 'faça uma pergunta' }, 400)
    if (q.length > 1000) return json({ error: 'pergunta muito longa' }, 400)
    const userText = `AGORA: ${nowIso} (fuso ${tz}).\nPergunta: ${q}`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_SEARCH }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      tools: [{ google_search: {} }], // grounding com Google Search (Gemini 2.0+)
      generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
    })
    const { data, status, detail } = await callGemini(payload) // principal → reserva → rápido
    if (data == null) return failResponse(status, detail)
    const answer = rawText(data).trim()
    if (!answer) return json({ error: 'a IA não retornou resposta' }, 502)
    // Fontes do grounding: candidates[0].groundingMetadata.groundingChunks[].web.{uri,title}
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
    const seen = new Set<string>()
    const sources: { title: string; url: string }[] = []
    for (const c of chunks) {
      const uri = c?.web?.uri
      if (typeof uri === 'string' && uri && !seen.has(uri)) {
        seen.add(uri)
        sources.push({ title: String(c.web.title ?? uri).slice(0, 200), url: uri })
      }
      if (sources.length >= 8) break
    }
    return json({ ok: true, answer, sources })
  }

  // ── CREATE (default): texto livre → proposta estruturada de lembrete ──
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return json({ error: 'descreva o lembrete' }, 400)
  if (prompt.length > 2000) return json({ error: 'pedido muito longo' }, 400)
  const userText = `AGORA: ${nowIso} (fuso ${tz}).\nPedido do usuário: ${prompt}`
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_CREATE }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA_CREATE,
      temperature: 0.2,
      maxOutputTokens: 800,
    },
  })
  const { data, status, detail } = await callGemini(payload, true)
  if (data == null) return failResponse(status, detail)
  const parsed = parseJson(data)
  if (!parsed) return json({ error: 'resposta da IA ilegível' }, 502)
  const proposal = toProposal(parsed)
  if (!proposal.title) return json({ error: 'a IA não conseguiu entender o pedido' }, 422)
  return json({ ok: true, proposal })
})
