# SB Notas

Sistema de lembretes multiusuário: escreva lembretes próprios, que aparecem de forma **chamativa**
na tela, são **customizáveis** e podem ser **compartilhados em tempo real** com outras pessoas.
Leve, rápido e feito para crescer. Alvo: **Windows + Android + Web/PWA**. Tema dark preto/cinza com
destaque em **amarelo âmbar**.

> **Status:** Fase 0 (pesquisa/escopo) ✅ · Design ✅ · Fase 1 frontend + refinamentos ✅ ·
> Backend Supabase e casca nativa Tauri — pendentes. Roda hoje em **modo mock** (sem backend).

## Começar

Pré-requisitos: **Node.js 20 LTS ou 22+** e **Git**.

```bash
npm install
npm run dev      # http://localhost:5173
```

Login em modo mock: preencha os campos e clique **Entrar** (autenticação simulada nesta fase).

Scripts: `npm run dev` (servidor) · `npm run build` (`tsc --noEmit` + build) · `npm run preview`.

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
