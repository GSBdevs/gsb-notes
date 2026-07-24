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

**Só quando for mexer nas próximas fases (ainda NÃO necessário):**
| Fase | Instalar |
|---|---|
| Casca desktop **Tauri** (Windows) | **Rust** (rustup) + pré-requisitos do Tauri 2 (WebView2 já vem no Win11). Ver https://v2.tauri.app/start/prerequisites/ |
| Backend **Supabase** | Nada local obrigatório — criar projeto em supabase.com e preencher `.env` (ver `.env.example`). Opcional: Supabase CLI. |

> `node_modules/` e `.env` **não** vão no git (estão no `.gitignore`) — por isso o `npm install`
> e, na Fase 2, criar o `.env` a partir do `.env.example`.

---

## 2. Onde paramos (estado em 2026-07-21)

- **Fase 0 — pesquisa e escopo:** ✅ concluída. Tudo em [`docs/`](docs/00-README.md)
  (concorrentes, stack, arquitetura, modelo de dados/RLS, roadmap, fontes).
- **Design:** ✅ entregue. Protótipo `design/SB Notas.dc.html` + `design/handoff-front-para-code.md`.
- **Fase 1 — frontend:** ✅ o protótipo foi portado para a stack real (React+TS+Vite+Tailwind+
  Zustand+TanStack Query+Framer Motion). Telas: Auth, Mural (masonry), Editor (com prévia ao vivo),
  **Overlay de disparo** (a assinatura: glow+pulso, shake em urgente), Pessoas, Ajustes.
- **Refinamentos:** ✅ persistência local (reload mantém login e dados), acessibilidade
  (`:focus-visible`, cards por teclado), atalhos (`N` cria, `Esc` fecha).

**Verificado no browser:** login→mural, CRUD (criar lembrete persiste e reordena), overlay de
disparo, atalhos, persistência após reload, `tsc --noEmit` limpo, 0 erros de console em load fresco.

## 3. O que ainda NÃO foi feito

1. **Casca nativa (Tauri/Capacitor)** — nada empacotado ainda. O ambiente da última sessão não
   tinha Rust. Windows always-on-top "de verdade" depende disto.
2. **Backend Supabase** — não ligado. Schema + políticas RLS já estão desenhados em
   [`docs/03-arquitetura-escopo.md`](docs/03-arquitetura-escopo.md); falta criar o projeto,
   aplicar e trocar a impl em `src/services/notesService.ts`.
3. **Recorrência/snooze funcionais, filtros avançados, ações rápidas no card** — backlog de refino.

## 4. Decisão em aberto (do dono)

**Casca do Android: Tauri vs Capacitor.** Decisão **adiada** — foco atual é refinar o frontend.
Não bloqueia nada: o front React e o backend Supabase são idênticos nos dois caminhos.

## 5. Próximos passos sugeridos (escolha um)

- **A) Continuar refinando o frontend** (caminho escolhido na última sessão): ações rápidas no card
  (concluir/fixar sem abrir o editor), estado de erro no salvar, recorrência/snooze funcionais,
  auditoria de acessibilidade.
- **B) Ligar o Supabase:** criar projeto, aplicar schema+RLS de `docs/03`, implementar
  `SupabaseNotesService` (mesma interface `NotesService`), Auth real, Realtime para compartilhamento.
- **C) Casca Tauri (desktop):** instalar Rust, `npm create tauri-app` / adicionar `src-tauri`,
  configurar janela always-on-top e o plugin de notificação para o disparo real.

---

## 6. Prompt pronto para colar no Claude Code (outra máquina)

> Estou retomando o projeto **SB Notas** (lembretes multiusuário, dark + amarelo). Leia o
> `CLAUDE.md`, o `HANDOFF.md` e a pasta `docs/` para o contexto completo. Estado: Fase 0 (pesquisa/
> escopo) e o frontend da Fase 1 já estão prontos e verificados, rodando em modo mock
> (`npm install && npm run dev`). A casca nativa (Tauri) e o Supabase ainda não foram feitos, e a
> escolha da casca Android está adiada. Confirme que o app sobe em `http://localhost:5173` sem
> erros e então vamos continuar por **[A) refinar o frontend / B) ligar o Supabase / C) casca Tauri]**
> — vou escolher. Siga as regras de arquitetura do `CLAUDE.md` (UI nunca chama backend direto; casca
> atrás de `platform/`; tokens de cor como fonte única).

Ajuste o trecho **[A/B/C]** conforme o que quiser atacar primeiro.
