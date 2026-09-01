# HANDOFF — continuar o SB Notas em outra máquina

Este documento organiza o contexto para retomar o projeto exatamente de onde paramos, em outra
máquina, via `git clone`. Leia também [`CLAUDE.md`](CLAUDE.md) (o Claude Code carrega
automaticamente) e [`docs/`](docs/00-README.md).

---

## 1. O que instalar na outra máquina

**Obrigatório agora (frontend):**
| Ferramenta | Versão | Observação |
|---|---|---|
| **Git** | qualquer recente | para clonar o repositório |
| **Node.js** | **20 LTS ou 22+** (foi desenvolvido no 24) | inclui o `npm` |
| (opcional) VS Code + Claude Code | — | para continuar com IA |

Depois de clonar:
```bash
git clone <URL-DO-REPOSITORIO> sb-notas
cd sb-notas
npm install
npm run dev
```
Abre em `http://localhost:5173`. **Não precisa de mais nada** — o app roda 100% em modo mock
(dados em memória + `localStorage`). Login: qualquer coisa nos campos → botão **Entrar** (auth mockada).

**Para rodar/compilar a casca nativa desktop (Tauri — já implementada):**
| Item | Instalar |
|---|---|
| **Rust** (rustup, toolchain `x86_64-pc-windows-msvc`) | https://rustup.rs — obrigatório para `cargo`/`tauri`. |
| **Microsoft C++ Build Tools** (workload "Desktop C++") | linker MSVC + Windows SDK. WebView2 já vem no Win11. |
| **Smart App Control desligado** | senão o Rust não compila proc-macros (ver gotcha no §2). |

Com isso: `npm run tauri:dev` (janela nativa com hot-reload) e `npm run tauri:build` (instalador
`.msi`/`.exe` em `src-tauri/target/release/bundle/`).

**Só quando for mexer nas próximas fases (ainda NÃO necessário):**
| Fase | Instalar |
|---|---|
| Casca **Android** (**Capacitor** — decidido, §4) | Android Studio + SDK/NDK + JDK. Ainda não iniciado. |
| Backend **Supabase** | `.env` já preenchido (auth real, RLS, Realtime, Storage). Rodar migrações `0001`→`0017` no SQL Editor. |

> `node_modules/` e `.env` **não** vão no git (estão no `.gitignore`) — por isso o `npm install`
> e, na Fase 2, criar o `.env` a partir do `.env.example`.

---

## 2. Onde paramos (estado em 2026-08-28)

- **Fase 0 — pesquisa e escopo:** ✅ concluída. Tudo em [`docs/`](docs/00-README.md)
  (concorrentes, stack, arquitetura, modelo de dados/RLS, roadmap, fontes).
- **Design:** ✅ entregue. Protótipo `design/SB Notas.dc.html` + `design/handoff-front-para-code.md`.
- **Fase 1 — frontend:** ✅ o protótipo foi portado para a stack real (React+TS+Vite+Tailwind+
  Zustand+TanStack Query+Framer Motion). Telas: Auth, Mural (masonry), Editor (com prévia ao vivo),
  **Overlay de disparo** (a assinatura: glow+pulso, shake em urgente), Pessoas, Ajustes.
- **Refinamentos:** ✅ persistência local (reload mantém login e dados), acessibilidade
  (`:focus-visible`, cards por teclado), atalhos (`N` cria, `Esc` fecha).
- **Fase 1.5 — casca Tauri (Windows):** ✅ `src-tauri/` criado e funcional (Tauri 2 + Rust MSVC).
  Cobre os dois recursos de SO pedidos:
  - **Iniciar com o Windows** — via `tauri-plugin-autostart`, controlado por um **toggle real nos
    Ajustes** ("Sistema → Iniciar com o Windows"). O SO é a fonte da verdade (o toggle sincroniza
    com o estado real no boot). No boot o app é aberto com `--minimized` → começa escondido na bandeja.
  - **Notificação em qualquer lugar, mesmo minimizado/na bandeja** — `tauri-plugin-notification`
    (toast do SO) + a janela é trazida à frente `alwaysOnTop` no disparo (gated pelo toggle
    `ontop`, também ligado agora). **Fechar no X = esconder na bandeja** (mantém notificações e
    agenda vivos); tray com menu **Abrir/Sair**.
  - Arquitetura respeitada: tudo atrás de `src/platform/` (`web.ts` + `tauri.ts`, escolha automática
    por ambiente). **Nenhuma tela precisou mudar** para ganhar os recursos nativos.

**Verificado:** frontend `tsc --noEmit` limpo + `vite build` ok; `cargo check`/`tauri dev` compilam
e linkam (MSVC); janela nativa sobe sem panic; **autostart confirmado no registro** do Windows
(`HKCU\...\Run` → `SB Notas ... --minimized`). Fluxo web (login→mural, CRUD, overlay, persistência)
segue íntegro em modo mock.

> **Gotcha do ambiente (Windows):** o **Smart App Control** bloqueia as DLLs de *proc-macro* que o
> Rust compila (`os error 4551`), travando qualquer build Rust. Precisou ser **desligado** em
> Segurança do Windows (é irreversível sem reinstalar o SO). Sem isso, `cargo`/`tauri` não compilam.

- **Fase 2 — backend Supabase:** ✅ concluída (MVP funcional). Migrações em
  [`supabase/migrations/`](supabase/migrations) (schema+RLS sem recursão, RPC de busca por e-mail);
  setup em [`supabase/README.md`](supabase/README.md). Tudo atrás da interface `NotesService`
  (`hasSupabase ? Supabase : mock`):
  - **Auth real** (e-mail+senha, magic link) — `authService` + `useAuthSession`; sessão dirige o
    roteamento e hidrata o perfil do banco.
  - **CRUD + agendamento** (`remind_at` real via `datetime-local`; "Agendados" derivado do futuro);
    **agendador local** (`ReminderScheduler`) abre o overlay no horário com o app aberto.
  - **Compartilhamento** por e-mail (RPC `find_profile_by_email`, segura) + gerência de permissão/
    remoção; **Realtime** (Postgres Changes) sincroniza mural/pessoas ao vivo.
  - **Broadcast "disparar agora"** (`realtimeService` + `useLiveTrigger`): o lembrete aparece
    chamativo nos dispositivos dos compartilhados na hora.
  - Perfil editável (nome + cor de avatar); o "plano" foi removido do produto.

  > **Config do projeto Supabase:** as chaves usam o **novo formato** `sb_publishable_...`
  > (`VITE_SUPABASE_PUBLISHABLE_KEY` no `.env`); `@supabase/supabase-js` foi atualizado para suportá-lo.

- **Fase 3 — v1 (colaboração + distribuição):** ✅ tags/filtros no mural, **quadros
  compartilhados** (workspaces), **presença** (Realtime Presence, "online agora"), recibo
  **"visto por"**, atalho global no Windows, **auto-update Tauri via CI** (tag `vX.Y.Z` →
  `tauri-action`, repo `GSBdevs/gsb-notes`), e **modo offline v1** (cache do Query persistido +
  fila de mutações). Hardening do broadcast (Realtime Authorization) e permissão por-nota feitos.

- **Fase 4 — tarefas + colaboração por nota:** ✅ módulo **Tarefas** (`notes` com `kind='doc'` +
  checklist, tela `/tarefas`), **chat por nota** (comentários), **anexos** (Storage privado),
  **modal de visualização** do lembrete, **"criado por"**, **contatos** (adicionar por e-mail),
  temas (cor de destaque), webhooks + export .ics, abas Ativos/Concluídos. E2E **pulado** (decisão do dono).

- **Fase 5 — notificações, perfil e layout (grande lote):** ✅
  - **Notificações** (sino na topbar, painel, realtime) geradas por *triggers* no banco: nota
    compartilhada/criada/**editada** (com quem editou), item de checklist concluído, tarefa
    finalizada, convite de contato.
  - **Contatos por convite/aceite** — um envia, o outro aceita, e os **dois** viram contato
    (bidirecional).
  - **Checklist virou tabela** (`note_checklist_items`): quem só VÊ marca itens, registra **quem
    concluiu cada um**, e a tarefa **conclui sozinha** quando todos os itens são marcados (removido
    o check do título).
  - **Perfil**: bug das cores/nome (voltavam pro amarelo) corrigido — agora grava em `profiles`;
    **foto de perfil** (bucket `avatars`), exibida em todos os avatares.
  - **Login**: magic link removido, **recuperação de senha por e-mail** (`resetPasswordForEmail`
    + tela de nova senha no evento `PASSWORD_RECOVERY`).
  - **Layout**: **escala da interface** (zoom em Ajustes), **mural em lista ou cards**,
    Integrações removidas de Ajustes (só a UI), **paleta expandida** (14 cores), **code splitting**
    (bundle inicial 740 kB → ~128 kB). "Simular/testar disparo" e o toggle de presença removidos.
  - **Pesquisa de apps similares** atualizada em [`docs/07-pesquisa-apps-similares.md`](docs/07-pesquisa-apps-similares.md)
    (backlog priorizado: auto-snooze persistente, quick-add em linguagem natural, recorrência
    avançada, compartilhar por link, localização, listas de compras).

  > **Migrações:** rodar **`0001`→`0017`** em ordem no SQL Editor. As da Fase 5: `0014_notifications`,
  > `0015_contact_invites`, `0016_checklist_items` (crítica — converte checklists antigos), `0017_avatars`.
  > **Auth URL** do Supabase precisa ter Site URL + Redirect URLs com a origem do app (p/ o reset de senha).

## 3. O que ainda NÃO foi feito

1. **DM entre usuários** — mensagem direta 1:1 em Pessoas (**próximo passo pedido pelo dono**).
2. **Casca nativa — Android (Capacitor)** — decisão fechada em **Capacitor** (§4); scaffold ainda
   não iniciado. Desbloqueia RF-06 (notificação Android), **lembrete por localização** (geofencing)
   e a distribuição mobile.
3. **Web Push (app 100% fechado)** — código pronto; o dono decidiu **ligar depois** (gerar VAPID,
   deploy da Edge Function `dispatch-reminders-push`, agendar `pg_cron`).
4. **Empacotar/assinar o instalador Windows** para release (o auto-update por CI já funciona).
5. **Incrementos do backlog** (ver [`docs/07`](docs/07-pesquisa-apps-similares.md)) — auto-snooze
   persistente, quick-add em linguagem natural, recorrência avançada, etc.

## 4. Decisões do dono

- **Casca Android: Capacitor** (decidido). Vai exigir Android Studio + SDK/NDK + JDK.
- **Updater Tauri**: testado e funcionando.
- **Web Push**: adiado para ligar depois.
- **E2E**: pulado.
- **Reset de senha**: por e-mail (fluxo seguro do Supabase), não reset interno sem verificação.

## 5. Próximos passos (na ordem pedida pelo dono)

1. **DM entre usuários** (1:1 em Pessoas) — próximo.
2. **Casca Android (Capacitor)** — depois da DM.
3. (depois) Web Push, incrementos do backlog, empacotar instalador Windows.

---

## 6. Prompt pronto para colar no Claude Code (outra máquina)

> Estou retomando o projeto **SB Notas** (lembretes multiusuário, dark + amarelo). Leia o
> `CLAUDE.md`, o `HANDOFF.md`, a pasta `docs/` e a memória do projeto para o contexto completo.
> Estado: Fases 0–5 essencialmente completas — frontend, casca Tauri (Windows, com auto-update),
> Supabase ligado (auth/RLS/Realtime/Storage), tarefas, notificações, contatos por convite, foto de
> perfil, escala de UI, mural lista/cards. Migrações `0001`→`0017` no SQL Editor. Confirme que
> `npm run build` sobe limpo e então vamos seguir a ordem pedida: **1) DM entre usuários 1:1;
> 2) casca Android (Capacitor)**. Regras de arquitetura do `CLAUDE.md` valem (UI nunca chama backend
> direto — tudo via `notesService`; casca atrás de `platform/`; tokens de cor como fonte única; pt-BR).
> O dono faz os commits/PRs à mão — não commitar sem pedir.
