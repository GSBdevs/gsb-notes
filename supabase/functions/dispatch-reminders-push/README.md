# dispatch-reminders-push — Web Push do lembrete com o app fechado

Envia **Web Push** aos alvos de um lembrete quando ele vence (dono + compartilhados + membros do
quadro), mesmo com o app 100% fechado na PWA. Roda de minuto em minuto via `pg_cron`.

> O assistente escreveu isto, mas **o deploy e o teste são seus** (eu não tenho acesso ao seu
> projeto). Segue o passo a passo. Pré-requisito: migração `0008_push_subscriptions.sql` aplicada.

## 1. Gerar as chaves VAPID
```bash
npx web-push generate-vapid-keys
```
- **Public Key** → `.env` do front: `VITE_VAPID_PUBLIC_KEY=...` (rebuild do app depois).
- **Private Key** → secret da function (passo 3). Nunca vai no front.

## 2. Instalar a CLI e fazer login (uma vez)
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
```

## 3. Deploy da function + secrets
```bash
supabase functions deploy dispatch-reminders-push --no-verify-jwt
supabase secrets set VAPID_PUBLIC_KEY=<pub> VAPID_PRIVATE_KEY=<priv> VAPID_SUBJECT=mailto:voce@dominio.com
# opcional, para proteger o endpoint do cron:
supabase secrets set CRON_SECRET=<uma-string-aleatoria>
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente da function — não precisa setar.

## 4. Agendar com pg_cron (SQL Editor)
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sb-notas-dispatch-push',
  '* * * * *', -- a cada minuto
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-reminders-push',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>', -- gateway das functions
      'x-cron-secret', '<CRON_SECRET>'              -- só se você setou o secret acima
    ),
    body    := '{}'::jsonb
  );
  $$
);
```
Para remover depois: `select cron.unschedule('sb-notas-dispatch-push');`

## Como testar
1. Ative "Notificações push" nos **Ajustes** do app (precisa de HTTPS — funciona no deploy, ou em
   `localhost` com o build de produção servido; a permissão do navegador precisa ser concedida).
2. Crie um lembrete para daqui a ~2 min, **feche o app/aba completamente**.
3. No horário, deve chegar a notificação do SO. Clicar abre o app.

## Notas de projeto
- **Sem duplicar:** o service worker (`src/sw.ts`) só mostra a notificação se **não** houver janela
  visível — com o app aberto, quem dispara é o overlay chamativo local.
- **Dedup do cron:** `notes.pushed_at` evita reenvio; a recorrência reabre o envio quando `remind_at`
  avança para a próxima ocorrência.
- **Alternativa Deno-nativa:** se `npm:web-push` der problema no runtime, dá para trocar por
  `jsr:@negrel/webpush` (mesma ideia; muda só a chamada de envio).
- **iOS:** Web Push exige o app **instalado** (Add to Home Screen) no iOS 16.4+ — mas iOS está fora
  de escopo do projeto.
