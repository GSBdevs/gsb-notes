# 04 — Roadmap

Plano de entrega em fases. Cada fase é utilizável por si só; nada aqui exige "big bang".

## Fase 0 — Pesquisa e escopo ✅ (concluída)
- Pesquisa de concorrentes ([`01`](01-pesquisa-concorrentes.md)).
- Pesquisa e escolha de stack ([`02`](02-pesquisa-stack.md)).
- Arquitetura, modelo de dados e escopo ([`03`](03-arquitetura-escopo.md)).
- Briefing de design ([`../design/`](../design/PROMPT-CLAUDE-DESIGN.md)).

## Fase 1 — Fundação (scaffold)
**Meta:** projeto rodando nas três plataformas, vazio mas navegável.
1. **Travar a decisão em aberto:** Tauri-Android vs Capacitor-Android.
2. Scaffold Vite + React + TS + Tailwind com os tokens de cor (preto/cinza/amarelo).
3. Integrar Tauri 2 (janela desktop + build Android) e configurar PWA.
4. Criar projeto Supabase, aplicar o schema e as políticas RLS de [`03`](03-arquitetura-escopo.md).
5. Camada `services/` abstraindo o Supabase; `authService` com login funcionando.
- **Entregável:** app instala no Windows, roda no Android e abre na Web; login real.

## Fase 2 — MVP funcional ✅ (concluída — backend Supabase ligado)
**Meta:** o produto faz o que promete para um usuário e para um par compartilhado.
1. ✅ CRUD de lembretes + customização (cor, prioridade, pin) — RF-02/03.
2. ✅ Mural/lista com busca e estados (ativos/agendados/arquivados) — RF-09.
3. ✅ Agendamento (`remind_at`) + **disparo chamativo**: agendador local abre o overlay no
   horário; overlay always-on-top no desktop (RF-05). Notificação de alta prioridade no
   **Android (RF-06) fica pendente da casca Android** (Tauri vs Capacitor, adiado).
4. ✅ Compartilhar 1:1 por e-mail com permissão + **sincronização em tempo real**
   (Postgres Changes) — RF-07/08.
5. ✅ Broadcast "aparecer agora" nos dispositivos dos compartilhados (Realtime Broadcast).
- **Entregável:** dois usuários compartilham um lembrete e ambos o veem disparar. ✅

> **Pendências da Fase 2 (reforços):**
> - ✅ *Hardening* do broadcast (**Realtime Authorization**, migração `0007`): canal pessoal privado
>   + RPC `broadcast_fire` autorizada. *Pendente teste logado do dono.*
> - ✅ Permissão de compartilhamento **por-nota** na tela Pessoas (toggle Ver/Editar por lembrete no
>   painel da pessoa; a ação em massa por pessoa continua disponível no serviço).
> - ✅ Disparo com o app fechado: **catch-up na reabertura/refoco** + **Web Push** (PWA) — SW
>   `injectManifest` com handler de push, tabela `push_subscriptions` (migração `0008`), toggle nos
>   Ajustes, e Edge Function `dispatch-reminders-push` + `pg_cron`. *Pendente deploy/teste do dono
>   (gerar VAPID, deploy da function, cron).*
> - ⬜ Notificação Android (depende da casca — próximo: **Capacitor**).

## Fase 3 — v1 (robustez e colaboração) — em andamento
- ✅ **Recorrência + snooze** — agendador reagenda a próxima ocorrência; "Adiar 10 min" real.
- ✅ **Tags/filtros** — etiquetas por lembrete (coluna `tags`) + filtro por tag no mural.
- ✅ **Presença** — "online" em tempo real (Realtime Presence) e **"visto por" (read receipts)**
  (tabela `note_reads`, migração `0005`; badge no card + linha no overlay de disparo).
- ✅ **Atalho global no Windows** — `Ctrl+Shift+S` traz/esconde a janela (Tauri
  `global-shortcut`); o tray já existia. **Widget Android** ainda depende da casca Android.
- ✅ **Grupos/quadros (workspaces)** — modelo **quadros completos** (decisão do dono): tabelas
  `workspaces` + `workspace_members` (migração `0006`), notas pertencem ao quadro, membros veem/criam,
  seletor "Pessoal / quadros" no mural, gestão de membros. *Pendente teste logado do dono.*
- ✅ **Atualização automática** — PWA via service worker (recarregar aplica); **Tauri updater**
  (plugin + `UpdateBanner`, instala/relança de dentro do app). *Pendente do dono: chave de assinatura
  + hospedar `latest.json` — ver [`06-atualizacao-app.md`](06-atualizacao-app.md).*
- ✅ **Modo offline (v1)** — cache do Query **persistido** (`PersistQueryClientProvider` +
  localStorage): leitura offline + partida instantânea. Mutações offline **pausam** com update
  otimista e **resumem sozinhas ao reconectar** (fila em sessão; LWW natural). Indicador "Offline"
  no topo + toasts de transição. *Edge não coberto:* fila que sobrevive a **reload com o app
  fechado** offline (exigiria persistir mutações + mutation defaults) — enhancement futuro.
- ⬜ **Casca/widget Android** — **adiado de novo** pelo dono; quando voltar, casca = **Capacitor**.

## Fase 4 — Expansão (backlog aberto — R6)
- ✅ **Comentários** em lembretes (migração `0009`, `note_comments` + RLS + realtime; seção no
  editor com apagar próprios). *Pendente teste logado do dono.*
- ✅ **Anexos** (migração `0010`, `note_attachments` + bucket privado `note-attachments` + policies de
  Storage; seção no editor com upload, miniatura de imagem, download por URL assinada, apagar
  próprios). *Pendente do dono: rodar a 0010 (inclui criar o bucket) e testar logado.*
- ⬜ Lembretes por localização, criptografia E2E opcional, integrações (webhooks/calendário),
  temas customizáveis.
- Cada item entra como módulo isolado, sem tocar no núcleo.

## Marcos de decisão
| Momento | Decisão |
|---|---|
| Início Fase 1 | Casca Android: Tauri vs Capacitor |
| Fim Fase 2 | Manter Supabase free tier ou migrar para PocketBase self-host |
| Início Fase 3 | Modelo de workspaces: grupos leves vs quadros completos |

## Riscos ativos a monitorar
- Maturidade do Android no Tauri (ver mitigação em [`02` §5](02-pesquisa-stack.md)).
- Restrições do Android para disparo "full-screen" em segundo plano (permissões de alarme exato).
- Pausa de projeto do Supabase free tier em caso de inatividade prolongada.
