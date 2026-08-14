# SB Notas

Sistema de lembretes multiusuário: escreva lembretes próprios, que aparecem de forma **chamativa**
na tela, são **customizáveis** e podem ser **compartilhados em tempo real** com outras pessoas.
Leve, rápido e feito para crescer. Alvo: **Windows + Android + Web/PWA**. Tema dark preto/cinza com
destaque em **amarelo âmbar**.

> **Status:** Fase 0/Design/Fase 1 ✅ · Casca **Tauri (Windows)** ✅ · **Supabase** (Auth, CRUD,
> Realtime, compartilhamento, agendamento) ✅ (Fase 2 em andamento — disparo server-side pendente).
> Sem `.env`, roda em **modo mock**; com `.env` preenchido, usa o Supabase.

## Começar (web)

Pré-requisitos: **Node.js 20 LTS ou 22+** e **Git**.

```bash
npm install
npm run dev      # http://localhost:5173
```

- **Modo mock** (sem `.env`): login simulado — preencha os campos e clique **Entrar**.
- **Modo Supabase** (com `.env`): cadastro/login reais. Ver [`supabase/README.md`](supabase/README.md).

Scripts: `npm run dev` (servidor) · `npm run build` (`tsc --noEmit` + build) · `npm run preview`.

## Rodar no desktop (Tauri — Windows)

App nativo com os recursos de SO: **iniciar com o Windows** (toggle nos Ajustes), **notificação
mesmo minimizado/na bandeja**, **overlay always-on-top** no disparo, e **fechar = esconder na
bandeja**.

**Pré-requisitos (instalar uma vez):**

| Item | Observação |
|---|---|
| **Rust** (via [rustup](https://rustup.rs)) | toolchain `x86_64-pc-windows-msvc` |
| **Microsoft C++ Build Tools** | workload "Desenvolvimento para desktop com C++". WebView2 já vem no Win11 |
| **Smart App Control DESLIGADO** | senão o Rust não compila as *proc-macros* (`os error 4551`). É irreversível — ver [`HANDOFF.md`](HANDOFF.md) §2 |

**Comandos:**

```bash
npm run tauri:dev      # abre a janela nativa com hot-reload (desenvolvimento)
```
```bash
npm run tauri:build    # gera o instalador .msi/.exe em src-tauri/target/release/bundle/
```

> Notas: em `tauri:dev`, o *toast* do Windows às vezes só aparece com o app **instalado**
> (`tauri:build`) — always-on-top e bandeja funcionam em dev. Não edite arquivos dentro de
> `src-tauri/` com o `tauri:dev` rodando (o watcher recompila a cada mudança).

## Stack

React 18 · TypeScript · Vite 5 · Tailwind 3 (dark-only) · Zustand · TanStack Query · Framer Motion ·
react-router · lucide-react · vite-plugin-pwa. Backend previsto: **Supabase** (Postgres + Auth +
Realtime + RLS). Casca nativa prevista: **Tauri 2** (Windows/Android).

## Estrutura

```
docs/       pesquisa, escopo, arquitetura, roadmap, fontes
design/     protótipo visual + tokens + briefing + handoff front→code
src/        frontend (screens, components, store, hooks, services, platform, styles)
CLAUDE.md   contexto do projeto (carregado pelo Claude Code)
HANDOFF.md  como retomar em outra máquina + o que instalar + próximos passos
```

## Documentação

- **Retomar o projeto / outra máquina:** [`HANDOFF.md`](HANDOFF.md)
- **Contexto p/ Claude Code:** [`CLAUDE.md`](CLAUDE.md)
- **Pesquisa e arquitetura:** [`docs/`](docs/00-README.md)
- **Design (tokens, protótipo, handoff):** [`design/`](design/PROMPT-CLAUDE-DESIGN.md)

## Licença

Projeto privado — GrupoSB.
