# SB Notas — Documentação de Pesquisa e Escopo

> Sistema de lembretes multiusuário: escreva lembretes próprios, veja-os aparecer de forma
> chamativa na tela, customize-os e compartilhe com outras pessoas — num ambiente leve,
> rápido e aberto a evoluir com o tempo.

Esta pasta reúne a **fase 0** do projeto: pesquisa de mercado, definição de stack,
arquitetura e escopo. Nenhum código de aplicação é escrito aqui ainda — o objetivo é
travar as decisões antes de começar a construir.

## Como navegar

| Arquivo | Conteúdo |
|---|---|
| [`01-pesquisa-concorrentes.md`](01-pesquisa-concorrentes.md) | Sistemas parecidos no mercado, forças/fraquezas e o *gap* que o SB Notas ocupa. |
| [`02-pesquisa-stack.md`](02-pesquisa-stack.md) | Comparação de frameworks e backends; **stack recomendada** com justificativa. |
| [`03-arquitetura-escopo.md`](03-arquitetura-escopo.md) | Visão de produto, requisitos, arquitetura técnica, modelo de dados e segurança. |
| [`04-roadmap.md`](04-roadmap.md) | Fases de entrega: MVP → v1 → futuro. |
| [`05-fontes.md`](05-fontes.md) | Bibliografia — todas as fontes consultadas. |
| [`06-atualizacao-app.md`](06-atualizacao-app.md) | Fluxo de auto-update (Tauri + CI). |
| [`07-pesquisa-apps-similares.md`](07-pesquisa-apps-similares.md) | Apps similares atualizados + **backlog priorizado de incrementos**. |
| [`08-casca-android-capacitor.md`](08-casca-android-capacitor.md) | Casca Android (Capacitor): scaffold pronto + passo a passo do build nativo. |
| [`09-pesquisa-blocos-anotacao.md`](09-pesquisa-blocos-anotacao.md) | Pesquisa: aba de blocos (editor estilo Notion; recomenda BlockNote). |
| [`10-pesquisa-hierarquia-usuarios.md`](10-pesquisa-hierarquia-usuarios.md) | Pesquisa: hierarquia de usuários (papéis RBAC vs. organograma). |

O briefing visual para o front (a ser construído com apoio do Claude em modo design)
está na pasta irmã [`../design/`](../design/PROMPT-CLAUDE-DESIGN.md).

## Resumo executivo (TL;DR)

- **Nome:** SB Notas
- **Plataformas-alvo:** Windows (desktop) + Android (mobile) + Web (PWA). iOS fora de escopo.
- **Diferencial:** unir três coisas que hoje vivem em apps separados —
  (1) lembretes que **aparecem de forma chamativa/impossível de ignorar** na tela,
  (2) **customização** visual por lembrete, e
  (3) **compartilhamento colaborativo em tempo real** com outras pessoas — tudo num app leve.
- **Stack recomendada:** frontend único em **React + TypeScript + Vite** empacotado por
  **Tauri 2** (Windows + Android) e servido como **PWA** na web; backend **Supabase**
  (Postgres + Auth + Realtime + RLS). Alternativas documentadas em [`02`](02-pesquisa-stack.md).
- **Identidade visual:** dark theme em tons de preto/cinza com destaques em **amarelo âmbar**.

## Estado

Fase 0 (pesquisa + escopo) — **concluída neste documento**. Próximo passo: aprovar a stack
e iniciar o scaffold do projeto (ver [`04-roadmap.md`](04-roadmap.md)).
