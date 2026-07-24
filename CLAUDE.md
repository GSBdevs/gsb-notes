# SB Notas — instruções do projeto (para o Claude Code)

> Este arquivo é carregado automaticamente. Leia junto: [`HANDOFF.md`](HANDOFF.md) (estado da
> última sessão + próximos passos) e [`docs/`](docs/00-README.md) (pesquisa, escopo, arquitetura).

## O que é
**SB Notas** — sistema de lembretes multiusuário. O usuário escreve lembretes próprios, que
aparecem de forma **chamativa** na tela, são **customizáveis** por lembrete e podem ser
**compartilhados em tempo real** com outras pessoas. Leve, rápido, expansível.
Alvo: **Windows + Android + Web/PWA** (como o Notion). **iOS fora de escopo.**
Identidade: dark preto/cinza com destaque **amarelo âmbar** (`#FACC15`).

## Stack (decidida — não reabrir sem motivo)
- **Frontend (único p/ todas as plataformas):** React 18 + TypeScript + **Vite 5** + **Tailwind 3**
  (dark-only) + **Zustand** (estado de UI) + **TanStack Query** (dados) + **Framer Motion**
  (animações) + react-router-dom + lucide-react + vite-plugin-pwa.
- **Backend (Fase 2, ainda não ligado):** **Supabase** (Postgres + Auth + Realtime + RLS).
  Enquanto `.env` estiver vazio, o app roda 100% num **serviço mock** em memória + `localStorage`.
- **Casca nativa (ainda não feita):** **Tauri 2** para Windows/Android. Precisa de **Rust**.
  Alternativa p/ Android: **Capacitor** (decisão adiada — ver HANDOFF).

## Regras de arquitetura (importante)
- **A UI nunca chama o backend direto.** Todo acesso a dados passa por `src/services/notesService.ts`
  (interface `NotesService`). Trocar mock → Supabase = trocar só a implementação exportada ali.
- **A "presença chamativa" (overlay/always-on-top/notificação) fica atrás de `src/platform/`.**
  Hoje é a impl web; a impl Tauri entra sem tocar nas telas.
- **Tokens de cor = fonte única** em `src/styles/tokens.css`, espelhados no `tailwind.config.ts` e em
  `design/design-tokens.md`. Amarelo é **destaque**, nunca fundo. Cor do lembrete vai na **borda**.
- Componentes em `screens/` (telas) e `components/` (kit). Estado efêmero no Zustand; dados no Query.

## Mapa de arquivos
```
src/
├── App.tsx                     rotas (/login, /, /pessoas, /ajustes) + overlays globais + atalhos
├── main.tsx                    QueryClientProvider + render
├── types.ts                    Reminder, ReminderDraft, Priority, Status, Perm, Person, Settings
├── lib/constants.ts            CARD_COLORS, PRIORITIES, RECURRENCES
├── data/mock.ts                SEED_REMINDERS, SEED_PEOPLE
├── services/
│   ├── supabase.ts             client (null enquanto .env vazio) → hasSupabase
│   └── notesService.ts         interface + MockNotesService (localStorage). TROCAR AQUI na Fase 2
├── platform/index.ts           casca nativa abstraída (web hoje; Tauri depois)
├── store/useAppStore.ts        Zustand (auth, abas, busca, editor, disparo, toast, settings) + persist
├── hooks/                      useReminders (+selectMural), usePeople, useKeyboardShortcuts
├── components/
│   ├── ReminderCard.tsx        card presentacional (usado no mural e na prévia)
│   ├── layout/AppShell.tsx     sidebar (desktop) + bottom-nav/FAB (mobile) + topbar
│   ├── editor/ReminderEditor.tsx  modal/tela-cheia: form + prévia ao vivo + "testar disparo"
│   ├── trigger/TriggerOverlay.tsx A ASSINATURA: glow+pulso, shake em urgente, ações
│   └── ui/                      Icon, primitives (Avatar/AvatarStack/PriorityBadge/Toggle), Toast
├── screens/                    Auth, Mural, People, Settings
└── styles/                     tokens.css + index.css (Tailwind + focus-visible + masonry)
```

## Como rodar
```bash
npm install
npm run dev        # Vite em http://localhost:5173
npm run build      # tsc --noEmit + vite build
```

## Convenções / gotchas
- **Idioma:** UI e docs em **português (pt-BR)**.
- **Persistência (Fase 1):** lembretes em `localStorage` (`sb-notas.reminders.v1`); auth+settings via
  `zustand/persist` (`sb-notas.app.v1`). Reload mantém login e dados. Limpar = apagar essas chaves.
- **Atalhos:** `N` cria lembrete, `Esc` fecha overlay (`hooks/useKeyboardShortcuts.ts`).
- **Botão "Simular disparo"** e o teste de disparo são **dev-only** (`import.meta.env.DEV`) — não vão p/ produção.
- **Protótipo de design:** `design/SB Notas.dc.html` é artefato da ferramenta de design (referencia um
  `support.js` que não existe no repo) — **não renderiza sozinho**; é fonte de verdade **visual**.
  O conteúdo dele já foi traduzido em `design/handoff-front-para-code.md`.
- **Verificação:** rode `npm run dev` e valide no browser (o app é observável). `tsc --noEmit` deve passar limpo.

## Estado atual e próximos passos
Ver [`HANDOFF.md`](HANDOFF.md) e [`docs/04-roadmap.md`](docs/04-roadmap.md). Em resumo:
Fase 0 (pesquisa/escopo) ✅ · Design ✅ · Fase 1 (frontend + refinamentos) ✅.
Pendente: (1) casca Android Tauri vs Capacitor (adiado) · (2) `src-tauri` p/ Windows (precisa Rust) ·
(3) ligar Supabase (schema+RLS+Auth+Realtime) trocando a impl de `notesService`.
