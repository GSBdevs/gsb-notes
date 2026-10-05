# Edge Function: `ai-assistant`

Ferramenta de IA **de teste**, exclusiva da conta **master**. Transforma um pedido em linguagem
natural numa **proposta estruturada de lembrete**. A IA **não grava nada** — o app abre o editor
pré-preenchido e o usuário confirma/salva pelo fluxo normal.

## Por que uma Edge Function
A chave da API do provedor (Gemini) **não pode** ir para o app (é pública no front). Ela fica aqui,
no servidor. A function ainda verifica, com a `service_role`, que quem chamou é **master** antes de
responder — mesmo gating do painel Admin.

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

## Segurança
- Só master passa (checado no servidor com `service_role`, ignora RLS).
- A IA só **propõe**; quem grava é o usuário, pelo editor, via `notesService`.
- Entrada limitada a 2000 caracteres; saída normalizada e truncada antes de voltar.
