# Supabase — setup da Fase 2

Este diretório guarda o schema/migrações do backend. O app roda 100% em **mock** enquanto o
`.env` estiver vazio; ao preencher as chaves, ele passa a usar o Supabase de verdade
(`hasSupabase` em [`src/services/supabase.ts`](../src/services/supabase.ts)).

## Passo a passo (você faz — eu não crio conta nem insiro credenciais)

1. **Criar o projeto**: em [supabase.com](https://supabase.com) → *New project*. Guarde a senha do
   banco. Região: a mais próxima (ex.: São Paulo).
2. **Aplicar o schema**: no painel do projeto → **SQL Editor**, rode **TODAS** as migrações de
   [`migrations/`](migrations) **em ordem** (0001 → 0009). Cada uma é necessária (a 0008 só se for
   usar Web Push):
   - `0001_init.sql` — `profiles`, `notes`, `note_shares`, RLS, Realtime, trigger de perfil.
   - `0002_drop_plan.sql` — remove a coluna `plan` (não usada).
   - `0003_find_profile_by_email.sql` — RPC do **compartilhamento por e-mail** (sem ela, "Adicionar" por e-mail falha).
   - `0004_note_tags.sql` — coluna `tags`. **Sem ela, criar/listar lembretes falha** (o código lê/grava `tags`).
   - `0005_note_reads.sql` — tabela `note_reads` do **"Visto por"** (recibos de leitura). Sem ela, o
     mural não quebra, mas o recibo de quem viu não é registrado nem exibido.
   - `0006_workspaces.sql` — **quadros compartilhados** (`workspaces` + `workspace_members`), liga
     `notes.workspace_id` e estende a RLS de notas para os membros do quadro. Sem ela, criar/gerenciar
     quadros falha.
   - `0007_realtime_authorization.sql` — **hardening do "disparar agora"**: canal pessoal vira
     privado (RLS em `realtime.messages`, cada um ouve só o próprio) + RPC `broadcast_fire` autoriza
     o envio. **Rode ANTES de publicar o build que a acompanha** — o cliente passa a assinar o canal
     como privado; sem a política, o "fire" ao vivo deixa de chegar (degrada em silêncio, não quebra).
     Requer uma versão do Supabase com `realtime.send` (projetos atuais têm). Rollback: `drop policy
     sb_notas_receive_own_user_channel on realtime.messages;` + reverter o build.
   - `0008_push_subscriptions.sql` — **Web Push** (app fechado na PWA): tabela `push_subscriptions`
     + coluna `notes.pushed_at`. Depois, faça o deploy da Edge Function e o agendamento — ver
     [`functions/dispatch-reminders-push/README.md`](functions/dispatch-reminders-push/README.md)
     (gerar VAPID, `functions deploy`, `secrets set`, `pg_cron`). Web Push é opcional: sem a chave
     VAPID no `.env`, o toggle "Notificações push" aparece indisponível e o resto do app segue normal.
   - `0009_note_comments.sql` — **comentários** em lembretes (Fase 4): tabela `note_comments` +
     helper `can_see_note` + RLS (quem vê a nota comenta; apaga o autor ou o dono). Sem ela, a
     seção de comentários do editor falha.
   > Ao adicionar migrações novas numa sessão, rode-as antes de testar — senão o app quebra.
3. **Pegar as chaves**: **Project Settings → API** → copie **Project URL** e a chave **anon public**.
4. **Preencher o `.env`** na raiz do repo (copie de `.env.example`):
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. **Reiniciar o dev server** (`npm run dev`) — o Vite só lê o `.env` na inicialização.

> A chave **anon** é pública por design (vai no cliente); a segurança vem da **RLS** no banco,
> não do sigilo dela. **Nunca** coloque a chave `service_role` no front.

## Verificação rápida (depois do código da Fase 2 estar ligado)

- Criar uma conta na tela de login → deve aparecer uma linha em `auth.users` e outra em
  `public.profiles` (criada pelo trigger `handle_new_user`).
- Criar um lembrete → linha em `public.notes` com `owner_id = seu id`.
- Abrir em duas abas com contas diferentes e compartilhar → o Realtime replica a mudança.

## Alternativa via CLI (opcional)z
Com a [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link --project-ref <ref>` e
`supabase db push` aplicam as migrações deste diretório automaticamente.
