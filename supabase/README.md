# Supabase — setup da Fase 2

Este diretório guarda o schema/migrações do backend. O app roda 100% em **mock** enquanto o
`.env` estiver vazio; ao preencher as chaves, ele passa a usar o Supabase de verdade
(`hasSupabase` em [`src/services/supabase.ts`](../src/services/supabase.ts)).

## Passo a passo (você faz — eu não crio conta nem insiro credenciais)

1. **Criar o projeto**: em [supabase.com](https://supabase.com) → *New project*. Guarde a senha do
   banco. Região: a mais próxima (ex.: São Paulo).
2. **Aplicar o schema**: no painel do projeto → **SQL Editor** → cole o conteúdo de
   [`migrations/0001_init.sql`](migrations/0001_init.sql) e rode. Cria `profiles`, `notes`,
   `note_shares`, as políticas RLS e liga o Realtime.
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
