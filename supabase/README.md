# Supabase — setup da Fase 2

Este diretório guarda o schema/migrações do backend. O app roda 100% em **mock** enquanto o
`.env` estiver vazio; ao preencher as chaves, ele passa a usar o Supabase de verdade
(`hasSupabase` em [`src/services/supabase.ts`](../src/services/supabase.ts)).

## Passo a passo (você faz — eu não crio conta nem insiro credenciais)

1. **Criar o projeto**: em [supabase.com](https://supabase.com) → *New project*. Guarde a senha do
   banco. Região: a mais próxima (ex.: São Paulo).
2. **Aplicar o schema**: no painel do projeto → **SQL Editor**, rode **TODAS** as migrações de
   [`migrations/`](migrations) **em ordem** (0001 → 0005). Cada uma é necessária:
   - `0001_init.sql` — `profiles`, `notes`, `note_shares`, RLS, Realtime, trigger de perfil.
   - `0002_drop_plan.sql` — remove a coluna `plan` (não usada).
   - `0003_find_profile_by_email.sql` — RPC do **compartilhamento por e-mail** (sem ela, "Adicionar" por e-mail falha).
   - `0004_note_tags.sql` — coluna `tags`. **Sem ela, criar/listar lembretes falha** (o código lê/grava `tags`).
   - `0005_note_reads.sql` — tabela `note_reads` do **"Visto por"** (recibos de leitura). Sem ela, o
     mural não quebra, mas o recibo de quem viu não é registrado nem exibido.
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
