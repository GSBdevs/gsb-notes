# 03 — Arquitetura e Escopo do Projeto

Este documento traduz a pesquisa em um plano concreto: o que o **SB Notas** é, o que ele faz
(agora e depois), como é construído e como os dados fluem.

## 1. Visão do produto

> **SB Notas** é um ambiente de lembretes compartilhados. Você escreve lembretes próprios,
> customiza como eles aparecem, e eles surgem de forma **chamativa** na tela — sua e das
> pessoas com quem você compartilhou. Leve, rápido, e desenhado para crescer.

Pilares:
1. **Chamativo** — o lembrete não fica escondido num app; ele aparece por cima de tudo.
2. **Customizável** — cor, urgência, estilo e comportamento por lembrete.
3. **Compartilhado** — outras pessoas veem o mesmo lembrete, em tempo real.
4. **Leve e expansível** — abre rápido, cria rápido, e a arquitetura aceita novas funções.

## 2. Personas e casos de uso

| Persona | Cenário | Necessidade central |
|---|---|---|
| Indivíduo | "Preciso lembrar de tomar remédio às 14h, sem chance de ignorar." | Lembrete chamativo + alarme confiável |
| Dupla/família | "Eu e minha esposa compartilhamos a lista de contas do mês." | Lista/nota compartilhada em tempo real |
| Equipe pequena (ex.: GrupoSB) | "Avisar toda a equipe do balcão sobre uma pendência agora." | Broadcast de um lembrete para várias pessoas |
| Você (dono) | "Quero adicionar uma função nova daqui a 3 meses sem reescrever." | Arquitetura modular/expansível |

## 3. Requisitos funcionais

### 3.1 MVP (primeira versão utilizável)
- **RF-01** Autenticação (cadastro/login por e-mail + senha; magic link opcional).
- **RF-02** Criar, editar, arquivar e excluir lembretes (título, corpo, cor).
- **RF-03** Customização por lembrete: cor, prioridade/urgência, "fixar" (pin).
- **RF-04** Agendar lembrete (`remind_at`) com disparo.
- **RF-05** **Disparo chamativo no desktop**: popup/overlay always-on-top com a nota inteira.
- **RF-06** **Disparo no Android**: notificação de alta prioridade + som.
- **RF-07** Compartilhar um lembrete com outro usuário (permissão: ver ou editar).
- **RF-08** Sincronização em **tempo real** entre dispositivos e entre usuários compartilhados.
- **RF-09** Lista/mural de lembretes (ativos, agendados, arquivados) com busca simples.
- **RF-10** PWA instalável na Web; app instalável no Windows e Android.

### 3.2 v1 (pós-MVP)
- Recorrência (diário/semanal/custom) e snooze ("lembrar de novo em X min").
- Tags/etiquetas e filtros; cores por tag.
- Grupos/quadros compartilhados (workspace) além do compartilhamento 1:1.
- Presença: ver quem está online / quem já "viu" o lembrete.
- Widget de tela inicial no Android; tray/atalho global no Windows.
- Modo offline com fila de sincronização.

### 3.3 Futuro (backlog de expansão — R6)
- Anexos (imagens/arquivos via Supabase Storage).
- Lembretes por localização (geofence) no Android.
- Comentários/threads em um lembrete.
- Criptografia ponta-a-ponta opcional (inspiração: Standard Notes).
- Integrações (webhooks, calendário, e-mail).
- Temas customizáveis além do padrão (marketplace de estilos).

> A separação MVP/v1/futuro é intencional: o modelo de dados abaixo já reserva espaço para os
> itens futuros (campos `style`, `recurrence`, `workspace_id`) sem exigir migrações dolorosas.

## 4. Requisitos não-funcionais

| Código | Requisito | Meta |
|---|---|---|
| RNF-01 | Leveza | Instalador desktop < 15 MB; memória ociosa < 80 MB |
| RNF-02 | Fluidez | Abrir e criar um lembrete em < 1 s; UI a 60 fps nas animações |
| RNF-03 | Capacidade | Suportar dezenas de usuários simultâneos com folga (free tier) |
| RNF-04 | Confiabilidade do alarme | Disparo no horário mesmo com app em segundo plano |
| RNF-05 | Expansibilidade | Novas features sem reescrita do núcleo (camadas desacopladas) |
| RNF-06 | Multiplataforma | Windows + Android + Web a partir de um front |
| RNF-07 | Segurança | Isolamento de dados por usuário via RLS; nada vaza entre contas |

## 5. Arquitetura técnica

Três camadas, propositalmente desacopladas para proteger a expansibilidade (RNF-05):

```
  [ Camada de Apresentação ]  React + TS + Vite (UI, animações, theming)
              │  (só fala com a camada de dados via um "client" abstrato)
  [ Camada de Dados/Serviço ]  cliente Supabase + TanStack Query + stores Zustand
              │  (API abstrata: notesService, shareService, authService, realtimeService)
  [ Camada Nativa (casca) ]   Tauri: overlay/always-on-top, tray, notificações, alarme
              │
  [ Backend ]  Supabase: Postgres + Auth + Realtime + RLS
```

Princípios:
- **A UI nunca chama o Supabase direto** — sempre por um serviço (`services/notesService.ts` etc.).
  Isso permite trocar backend (Supabase → PocketBase) ou casca (Tauri → Capacitor) sem tocar na UI.
- **A "presença chamativa" é um recurso da casca nativa**, exposto por uma interface única
  (`platform.showReminderOverlay(note)`), com implementações por plataforma.

## 6. Modelo de dados (Postgres / Supabase)

Esquema inicial. `auth.users` é gerenciado pelo Supabase Auth; o resto é nosso.

```sql
-- Perfil público do usuário (1:1 com auth.users)
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Lembrete/nota
create table notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  title       text,
  body        text,
  color       text,                 -- cor base do card (ex.: '#FACC15')
  priority    smallint default 0,   -- 0 normal, 1 importante, 2 urgente
  pinned      boolean default false,
  style       jsonb default '{}',   -- customização: tamanho, animação, ícone... (expansível)
  remind_at   timestamptz,          -- quando disparar (null = sem alarme)
  recurrence  jsonb,                -- regra de repetição (futuro; null no MVP)
  workspace_id uuid,                -- grupo/quadro (futuro; null no MVP)
  status      text not null default 'active', -- active | done | archived
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Compartilhamento pessoa -> pessoa
create table note_shares (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references notes(id) on delete cascade,
  shared_with uuid not null references profiles(id) on delete cascade,
  permission  text not null default 'view', -- view | edit
  created_at  timestamptz not null default now(),
  unique (note_id, shared_with)
);

-- Etiquetas (v1)
create table tags (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references profiles(id) on delete cascade,
  name      text not null,
  color     text
);
create table note_tags (
  note_id uuid references notes(id) on delete cascade,
  tag_id  uuid references tags(id)  on delete cascade,
  primary key (note_id, tag_id)
);

-- Grupos/quadros compartilhados (v1/futuro)
create table workspaces (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  owner_id  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id      uuid references profiles(id)   on delete cascade,
  role         text not null default 'member', -- owner | admin | member
  primary key (workspace_id, user_id)
);
```

### Índices sugeridos
`notes(owner_id)`, `notes(remind_at)`, `note_shares(shared_with)`, `note_tags(tag_id)`.

## 7. Compartilhamento e tempo real

Como um lembrete "aparece igualmente" para outra pessoa:

1. **Persistência:** ao criar/editar, a nota vai para `notes`; o compartilhamento vai para
   `note_shares` (ou herda de `workspace`).
2. **Sincronização de estado (Postgres Changes):** cada cliente assina as mudanças das notas
   que pode ver (via RLS). Editou → todos os que têm acesso recebem o update na hora.
3. **Disparo ao vivo (Broadcast):** quando um lembrete deve "aparecer chamativo agora", um
   evento de *broadcast* no canal do usuário/grupo aciona o overlay em todos os dispositivos
   conectados — sem depender de polling.
4. **Presença (v1):** canal de *presence* mostra quem está online / quem já visualizou.
5. **Agendados:** para disparo no horário mesmo com app fechado, o agendamento local usa o
   plugin de notificação da casca (Tauri) — e, no futuro, um gatilho server-side
   (Supabase Edge Function + cron) pode reforçar o disparo cross-device.

## 8. Segurança (Row Level Security)

Isolamento por usuário é obrigatório (RNF-07). Exemplo de políticas para `notes`:

```sql
alter table notes enable row level security;

-- Ler: dono, ou alguém com quem foi compartilhada, ou membro do workspace
create policy notes_select on notes for select using (
  owner_id = auth.uid()
  or exists (select 1 from note_shares s
             where s.note_id = notes.id and s.shared_with = auth.uid())
  or (workspace_id is not null and exists (
        select 1 from workspace_members m
        where m.workspace_id = notes.workspace_id and m.user_id = auth.uid()))
);

-- Escrever: dono, ou compartilhado com permissão 'edit'
create policy notes_update on notes for update using (
  owner_id = auth.uid()
  or exists (select 1 from note_shares s
             where s.note_id = notes.id and s.shared_with = auth.uid()
               and s.permission = 'edit')
);

-- Inserir: apenas para si
create policy notes_insert on notes for insert with check (owner_id = auth.uid());
```

Auth: e-mail+senha e magic link no MVP; OAuth (Google) opcional. Tokens JWT do Supabase; a RLS
é aplicada no banco — o cliente nunca é fonte de verdade para permissão.

## 9. Estrutura de pastas proposta do projeto (para a Fase 1)

Layout padrão de um projeto Tauri + React, já preparado para as três plataformas:

```
reminder-software/
├── docs/                    # esta pesquisa/escopo (você está aqui)
├── design/                  # briefing e tokens para o front
├── src/                     # FRONTEND React (compartilhado por todas as plataformas)
│   ├── app/                 # rotas/telas
│   ├── components/          # componentes de UI
│   ├── features/            # domínios: notes, sharing, auth, reminders
│   ├── services/            # camada de dados (supabase abstraído) — UI não chama backend direto
│   ├── platform/            # abstração da casca: overlay, notificação, tray (impl. por plataforma)
│   ├── store/               # Zustand
│   ├── styles/              # Tailwind + tokens (preto/cinza/amarelo)
│   └── main.tsx
├── src-tauri/               # casca nativa (Windows + Android): Rust, config, ícones, permissões
├── supabase/                # migrations SQL, políticas RLS, seeds
├── public/                  # assets estáticos, manifest PWA
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

> Se o plano B (Capacitor no Android) for adotado, entra uma pasta `android/` gerada pelo
> Capacitor ao lado de `src-tauri/`, ainda consumindo o mesmo `src/`.

## 10. Decisões travadas nesta fase

- Frontend único React+TS+Vite; UI desacoplada do backend via camada `services/`.
- Backend Supabase (Postgres+Auth+Realtime+RLS); PocketBase como alternativa self-host.
- Modelo de dados com `notes` + `note_shares` no núcleo; `style`/`recurrence`/`workspace_id`
  reservados para expansão sem migração dolorosa.
- Casca nativa responsável pela "presença chamativa" atrás de uma interface única.
- **Em aberto:** Tauri-Android vs Capacitor-Android (não bloqueia; decidir no início da Fase 1).
