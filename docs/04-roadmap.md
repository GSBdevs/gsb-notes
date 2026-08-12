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

> **Pendências da Fase 2 (reforços, não bloqueiam o MVP):** disparo server-side com o app 100%
> fechado (Edge Function + `pg_cron`); notificação Android (depende da casca); *hardening* do
> broadcast (Realtime Authorization); permissão de compartilhamento realmente por-nota na tela
> Pessoas (hoje agregada por pessoa).

## Fase 3 — v1 (robustez e colaboração) — em andamento
- ✅ **Recorrência + snooze** — agendador reagenda a próxima ocorrência; "Adiar 10 min" real.
- ✅ **Tags/filtros** — etiquetas por lembrete (coluna `tags`) + filtro por tag no mural.
- 🟡 **Presença** — "online" em tempo real (Realtime Presence) ✅; "visto por" (read receipts) pendente.
- ⬜ **Grupos/quadros (workspaces)** — compartilhamento em grupo além do 1:1 (novas tabelas + UI).
- ⬜ **Widget Android + tray/atalho global no Windows** — widget depende da casca Android; o
  tray já existe (Tauri), falta o atalho global.
- ⬜ **Modo offline** com fila de sincronização (mais complexo — resolução de conflitos).

## Fase 4 — Expansão (backlog aberto — R6)
- Anexos (Storage), lembretes por localização, comentários, criptografia E2E opcional,
  integrações (webhooks/calendário), temas customizáveis.
- Cada item entra como módulo isolado em `features/`, sem tocar no núcleo.

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
