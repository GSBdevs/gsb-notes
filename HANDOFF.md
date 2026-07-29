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
| Casca **Android** (Tauri/Capacitor) | decisão adiada (§4); exigirá Android Studio + SDK/NDK + JDK. |
| Backend **Supabase** | Nada local obrigatório — criar projeto em supabase.com e preencher `.env` (ver `.env.example`). Opcional: Supabase CLI. |

> `node_modules/` e `.env` **não** vão no git (estão no `.gitignore`) — por isso o `npm install`
> e, na Fase 2, criar o `.env` a partir do `.env.example`.

---

## 2. Onde paramos (estado em 2026-07-29)

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

## 3. O que ainda NÃO foi feito

1. **Casca nativa — Android** — Tauri-Android vs Capacitor ainda **adiado** (ver §4). O Windows já
   está feito (Fase 1.5). Falta também **empacotar o instalador** do Windows para distribuição
   (`npm run tauri:build` gera `.msi`/`.exe`, mas ainda não foi assinado/versionado p/ release).
2. **Backend Supabase** — não ligado. Schema + políticas RLS já estão desenhados em
   [`docs/03-arquitetura-escopo.md`](docs/03-arquitetura-escopo.md); falta criar o projeto,
   aplicar e trocar a impl em `src/services/notesService.ts`.
3. **Recorrência/snooze funcionais, filtros avançados, ações rápidas no card** — backlog de refino.
4. **Agendamento persistente com o app 100% fechado** (processo encerrado) — hoje o disparo depende
   do app vivo (minimizado/na bandeja conta). O disparo com o processo morto exigirá alarme nativo
   (Windows Scheduled Task / AlarmManager no Android). O gancho já existe em `platform.scheduleReminder`.

## 4. Decisão em aberto (do dono)

**Casca do Android: Tauri vs Capacitor.** Decisão **adiada** — foco atual é refinar o frontend.
Não bloqueia nada: o front React e o backend Supabase são idênticos nos dois caminhos.

## 5. Próximos passos sugeridos (escolha um)

- **A) Continuar refinando o frontend:** ações rápidas no card (concluir/fixar sem abrir o editor),
  estado de erro no salvar, recorrência/snooze funcionais, auditoria de acessibilidade.
- **B) Ligar o Supabase:** criar projeto, aplicar schema+RLS de `docs/03`, implementar
  `SupabaseNotesService` (mesma interface `NotesService`), Auth real, Realtime para compartilhamento.
- **C) ✅ Casca Tauri (desktop Windows) — feita.** Próximo passo aqui: gerar/assinar o instalador
  (`npm run tauri:build`) e decidir a casca Android (§4).

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
