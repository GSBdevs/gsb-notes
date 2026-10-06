// Edge Function: ai-assistant
// Ferramenta de IA (teste, SÓ MASTER). A IA NUNCA grava nada. Dois modos (campo `mode` do body):
//   • create    (default): texto livre → PROPOSTA estruturada de lembrete. O app pré-preenche o
//                editor e o usuário confirma/salva pelo fluxo normal (notesService).
//   • summarize: lista de itens do usuário → RESUMO organizado/acionável em texto (só leitura).
// A chave do provedor fica aqui (secret no servidor), nunca no app.
//
// Provedor: Gemini (free tier) via REST generateContent. Create usa saída estruturada (responseSchema);
// summarize usa texto. Trocar de provedor depois = trocar a chamada; o contrato não muda.
//
// Deploy (uma vez, pelo dono):
//   supabase secrets set GEMINI_API_KEY=xxxx    (opcional: GEMINI_MODEL, GEMINI_MODEL_FALLBACK)
//   supabase functions deploy ai-assistant
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da function)

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
// gemini-2.0-flash foi descontinuado (404 "no longer available"); a própria API indica o gemini-3.8-flash.
// Dá para sobrepor sem redeploy: `supabase secrets set GEMINI_MODEL=<modelo>`.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

// ── create ───────────────────────────────────────────────────────────────────
// Prioridade e recorrência precisam bater com os tipos do app (src/types.ts).
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

const SCHEMA_CREATE = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    body: { type: 'STRING' },
    remindAt: { type: 'STRING' },
    priority: { type: 'STRING', enum: ['normal', 'important', 'urgent'] },
    recurrence: { type: 'STRING', enum: ['once', 'daily', 'weekly', 'monthly'] },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'priority', 'recurrence'],
}

// ── summarize ────────────────────────────────────────────────────────────────
const SYSTEM_SUMMARY = `Você é o assistente do SB Notas (pt-BR). Recebe a lista de itens do usuário
(lembretes e tarefas) e devolve um RESUMO organizado e acionável. Regras:
- NÃO invente itens que não estejam na lista.
- Priorize: atrasados e de hoje primeiro, depois urgentes/importantes, depois o restante.
- Para tarefas, considere o progresso (feitos/total).
- Termine com uma linha curta sugerindo por onde começar.
- NÃO use markdown (nada de #, *, **). Separe seções com um título curto em MAIÚSCULAS numa linha e
  itens começando com "- ".
- Seja conciso: no máximo ~200 palavras.`

/**
 * Chama o Gemini com retry+backoff para 429/500/502/503 e, se GEMINI_MODEL_FALLBACK estiver setado,
 * tenta o modelo de reserva. Retorna o JSON cru da resposta (data) ou o último status/detalhe de erro.
 */
// deno-lint-ignore no-explicit-any
async function callGemini(payload: string): Promise<{ data: any; status: number; detail: string }> {
  const fallback = (Deno.env.get('GEMINI_MODEL_FALLBACK') ?? '').trim()
  const models = [...new Set([GEMINI_MODEL, fallback].filter(Boolean))]
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
        resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
        })
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // 1) Identifica quem chamou pelo JWT do header.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'sem token' }, 401)
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'token inválido' }, 401)

  // 2) Confirma que o chamador é MASTER (ferramenta de teste — só o master usa).
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.user.id)
    .maybeSingle()
  if (roleRow?.role !== 'master') return json({ error: 'apenas o master pode usar o assistente' }, 403)

  // 3) Entrada.
  let body: { prompt?: string; nowIso?: string; tz?: string; mode?: string; items?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const nowIso = (body.nowIso ?? new Date().toISOString()).trim()
  const tz = (body.tz ?? 'America/Sao_Paulo').trim()
  const mode = body.mode === 'summarize' ? 'summarize' : 'create'
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY não configurada no servidor' }, 500)

  // ── Modo SUMMARIZE: resume/organiza a lista de itens do usuário (texto, só leitura) ──
  if (mode === 'summarize') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 80) : []
    if (items.length === 0) return json({ error: 'nada para resumir' }, 400)
    const focus = (body.prompt ?? '').trim().slice(0, 500)
    const userText =
      `AGORA: ${nowIso} (fuso ${tz}).\n` +
      `Foco do usuário: ${focus || 'resumo geral'}\n` +
      `Itens (JSON): ${JSON.stringify(items).slice(0, 12000)}`
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_SUMMARY }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.3 },
    })
    const { data, status, detail } = await callGemini(payload)
    if (data == null) return failResponse(status, detail)
    const summary = rawText(data).trim()
    if (!summary) return json({ error: 'a IA não retornou um resumo' }, 502)
    return json({ ok: true, summary })
  }

  // ── Modo CREATE: texto livre → proposta estruturada de lembrete ──
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return json({ error: 'descreva o lembrete' }, 400)
  if (prompt.length > 2000) return json({ error: 'pedido muito longo' }, 400)

  const userText = `AGORA: ${nowIso} (fuso ${tz}).\nPedido do usuário: ${prompt}`
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_CREATE }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_CREATE, temperature: 0.2 },
  })
  const { data, status, detail } = await callGemini(payload)
  if (data == null) return failResponse(status, detail)

  const raw = rawText(data)
  if (!raw) return json({ error: 'a IA não retornou uma proposta' }, 502)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: 'resposta da IA ilegível' }, 502)
  }

  const prio = ['normal', 'important', 'urgent']
  const recur = ['once', 'daily', 'weekly', 'monthly']
  const remindAt = typeof parsed.remindAt === 'string' && parsed.remindAt.trim() ? parsed.remindAt.trim() : null
  const proposal = {
    title: String(parsed.title ?? '').slice(0, 200),
    body: String(parsed.body ?? '').slice(0, 4000),
    remindAt: remindAt && !Number.isNaN(Date.parse(remindAt)) ? remindAt : null,
    priority: prio.includes(parsed.priority as string) ? (parsed.priority as string) : 'normal',
    recurrence: recur.includes(parsed.recurrence as string) ? (parsed.recurrence as string) : 'once',
    tags: Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t) => typeof t === 'string').slice(0, 3).map((t) => String(t))
      : [],
  }
  if (!proposal.title) return json({ error: 'a IA não conseguiu entender o pedido' }, 422)

  return json({ ok: true, proposal })
})
