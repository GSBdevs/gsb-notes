# Edge Function: `ai-assistant`

Ferramenta de IA **de teste**, exclusiva da conta **master**. A IA **nunca grava** — sempre devolve
uma proposta/ação que o app aplica pelo fluxo normal (`notesService`), com confirmação do usuário.

## Modos (campo `mode` do body)
- `create` (default): texto livre → proposta estruturada de lembrete (pré-preenche o editor).
- `chat`: conversa multi-turno (`messages: [{role, text}]`) → `{ reply, proposal }` (refina antes do editor).
- `edit`: `{ prompt, items:[{id,…}] }` → `{ edit: { targetId, patch, note } }` (identifica o item e o que muda).
- `organize`: `{ items:[{id,…}] }` → `{ summary, actions:[{targetId,label,patch}] }` (resumo + ações 1-a-1).
- `summarize`: `{ items }` → `{ summary }` (texto; mantido para compat).
- `search`: `{ prompt }` → `{ answer, sources[] }` via Google Search (grounding). Só a pergunta trafega.

## Por que uma Edge Function
A chave da API do provedor (Gemini) **não pode** ir para o app (é pública no front). Ela fica aqui,
no servidor. A function ainda verifica, com a `service_role`, que quem chamou é **master** antes de
responder — mesmo gating do painel Admin.

> **Sem dependências npm (de propósito).** A validação do JWT (`/auth/v1/user`) e a checagem de papel
> (`/rest/v1/user_roles`) são feitas via `fetch` nas APIs REST do Supabase. Importar
> `@supabase/supabase-js` arrastava `realtime-js` e quebrava o bundle quando um tarball transitivo
> some do registro npm (`Failed caching npm package '@supabase/realtime-js@…'`). **Não reintroduza** o
> supabase-js aqui sem necessidade.

## Provedor
Gemini (free tier) via REST `generateContent` com **saída estruturada** (`responseSchema`), então a
resposta já vem como JSON no formato do `ReminderDraft`. Trocar para outro provedor (ex.: Groq) =
trocar só a chamada `fetch`; o contrato de entrada/saída não muda.

> **LGPD / dados (teste):** o free tier do Gemini **pode treinar com o que for enviado**. Enquanto
> for ferramenta de teste, use **dados fictícios** — não envie dado real de usuário. Para liberar com
> dados reais, migrar para um tier/condição que não treina.

## Deploy (uma vez, pelo dono)
```bash
# 1) Chave do Gemini (https://aistudio.google.com/app/apikey — free, sem cartão)
supabase secrets set GEMINI_API_KEY=xxxxxxxx
# opcional: trocar o modelo (default gemini-3.8-flash; gemini-2.0-flash foi descontinuado)
# supabase secrets set GEMINI_MODEL=gemini-3.8-flash
# opcional: modelo de reserva, tentado se o principal ficar indisponível (429/500/503)
# supabase secrets set GEMINI_MODEL_FALLBACK=gemini-flash-latest
# opcional (OTIMIZAÇÃO): modelo rápido p/ os modos curtos (create/chat/edit/organize/summarize).
# Ex.: um flash-lite. Só o search usa o modelo principal (grounding). Vazio = usa o principal.
# supabase secrets set GEMINI_MODEL_FAST=gemini-flash-lite-latest

# 2) Deploy
supabase functions deploy ai-assistant
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das functions.

## Contrato
**Request** (via `supabase.functions.invoke('ai-assistant', { body })`):
```json
{ "prompt": "pagar a conta de luz sexta 14h, urgente", "nowIso": "2026-10-05T10:00:00-03:00", "tz": "America/Sao_Paulo" }
```
**Response** (sucesso):
```json
{ "ok": true, "proposal": {
  "title": "Pagar a conta de luz", "body": "",
  "remindAt": "2026-10-09T14:00:00-03:00",
  "priority": "urgent", "recurrence": "once", "tags": ["contas"]
} }
```
**Erros:** `401` sem/again token inválido · `403` não é master · `400` pedido vazio/grande ·
`500` `GEMINI_API_KEY` ausente · `503` modelo sobrecarregado (`{ retryable: true }` — tentar de novo) ·
`502/422` falha ou resposta inutilizável da IA. Sempre `{ error }`.

## Sobrecarga (429/500/502/503)
Picos de demanda no provedor são transitórios. A function **já reage**: faz **retry com backoff**
(2 novas tentativas por modelo) e, se `GEMINI_MODEL_FALLBACK` estiver setado, tenta o **modelo de
reserva** antes de desistir. Se ainda assim falhar, devolve `503 { retryable: true }` e a UI sugere
tentar de novo. Alternativas se persistir: pinar um modelo GA mais estável como principal (novos/preview
sobrecarregam mais), ou plugar o Groq como provedor B (trocar só a chamada `fetch`).

## Desempenho (otimização)
- **Modelo rápido por modo:** modos curtos/estruturados usam `GEMINI_MODEL_FAST` (se setado); só o
  `search` usa o modelo principal (precisa de grounding).
- **`maxOutputTokens`** por modo (menos geração = resposta mais rápida).
- **Timeout no cliente** (35s) em `aiService` — evita a UI pendurada; mostra "demorou demais".
- **Ainda em aberto (débito):** streaming token-a-token (maior ganho percebido, mas exige sair do
  `functions.invoke` para fetch+SSE) e cancelamento real da requisição. Deixados para depois.

## Segurança
- Só master passa (checado no servidor com `service_role`, ignora RLS).
- A IA só **propõe/sugere**; quem grava é o usuário, pelo editor, via `notesService`.
- Entrada limitada; itens enviados sem corpo; saída normalizada e truncada antes de voltar.
