# 02 — Pesquisa de Stack

Objetivo: escolher uma stack **rápida, fluida e leve**, com um único frontend rodando em
**Windows + Android + Web**, e um backend simples que suporte **compartilhamento em tempo real**
sem exigir grande capacidade de banco/usuários. Fontes em [`05-fontes.md`](05-fontes.md).

## 1. Requisitos que guiam a escolha

| # | Requisito | Origem |
|---|---|---|
| R1 | Um só código de frontend para Win + Android + Web | "funcione tanto na web quanto como app, como o Notion" |
| R2 | Rápido e fluido; bundle e memória baixos | pedido explícito |
| R3 | Lembrete **chamativo na tela** → precisa de controle de janela nativa (always-on-top/overlay) no desktop e notificação de alta prioridade no Android | conceito do produto |
| R4 | Compartilhamento **multiusuário em tempo real** | conceito do produto |
| R5 | Capacidade modesta de usuários/dados | pedido explícito |
| R6 | **Expansível** — fácil adicionar funções ao longo do tempo | pedido explícito |
| R7 | Windows + Android; **iOS fora de escopo** | pedido explícito |

## 2. Camada de aplicação (empacotamento multiplataforma)

Métricas aproximadas compiladas das fontes (variam por projeto, mas a ordem de grandeza é consistente):

| Framework | Linguagem base | Bundle instalador | Memória ociosa | Cold start | Android | Web/PWA | Always-on-top / overlay |
|---|---|---:|---:|---:|:---:|:---:|:---:|
| **Tauri 2** | Rust + webview do SO + seu front web | **~8 MB** | **~45 MB** | **~1,4 s** | ✅ (2.0+, ainda amadurecendo) | 🟡 via PWA/host separado | ✅ nativo (`alwaysOnTop`) |
| **Electron** | Node.js + Chromium embutido | ~165 MB | ~180 MB | ~3,2 s | ❌ (precisa de Capacitor/RN) | 🟡 via PWA/host separado | ✅ nativo |
| **Flutter** | Dart + engine Skia/Impeller | ~25 MB | ~90 MB | ~1,8 s | ✅ forte | 🟡 (Flutter Web pesado) | 🟡 via plugins |
| **React Native + Expo** | JS/TS nativo | — | — | — | ✅ forte | ✅ RN-for-Web | 🟡 desktop precisa de casca |

Leitura das fontes:
- **Tauri 2** (estável desde out/2024) reúne desktop + mobile num só codebase JS/Rust usando o
  **webview do próprio sistema** — daí o bundle 3–10 MB vs 150–200 MB do Electron e a memória
  muito menor. É a recomendação padrão de 2026 quando **tamanho e desempenho importam**.
- **Ponto de atenção honesto:** o suporte **Android** do Tauri 2, embora usável, é mais novo que
  o desktop — pode haver arestas em plugins, assinatura e quirks de webview. Não é bloqueador,
  mas é o principal risco técnico do projeto.
- **Electron** é a rota confortável para quem já domina Node.js (é o caso deste workspace), mas
  é pesado (fere R2) e **não cobre Android sozinho**.
- **Notion** valida o modelo "React na web + Electron no desktop + React Native no mobile" —
  porém são **três empacotadores**, o oposto de leve/simples que queremos.

### Decisão da camada de app

> **Frontend único em React + TypeScript + Vite**, empacotado por **Tauri 2** para
> **Windows e Android**, e publicado como **PWA** para a Web.

Por quê: atende R1 (um front), R2 (leve/fluido), R3 (always-on-top nativo no desktop +
plugin de notificação no Android), R7 (Win+Android sem custo de iOS). O front é React puro
(nada específico de Tauri no núcleo da UI), então **na pior hipótese trocamos só a casca**
sem reescrever o produto — o que protege R6.

**Plano B para o Android** (se o Tauri Android incomodar): manter o mesmo front React e
empacotar o Android com **Capacitor**, e o desktop com **Tauri** (ou Electron). O produto React
não muda. Essa reversibilidade é um dos motivos de manter a lógica fora da casca nativa.

## 3. Camada de backend (dados + tempo real + auth)

| Backend | Banco | Realtime | Auth | Self-host | Custo p/ app pequeno | Vendor lock-in |
|---|---|---|---|---|---|---|
| **Supabase** | Postgres (relacional, RLS) | ✅ Postgres Changes + Broadcast + Presence | ✅ completo (e-mail, magic link, OAuth) | 🟡 pesado (Docker multi-serviço) | Free tier generoso | Baixo (é Postgres) |
| **Firebase** | Firestore (NoSQL) | ✅ forte | ✅ | ❌ só nuvem | Blaze cobra por operação, **sem teto** | **Alto** |
| **PocketBase** | SQLite (1 binário Go) | ✅ API realtime | ✅ | ✅ **trivial** (1 executável) | Custo fixo de 1 VPS | Baixo |

Leitura das fontes:
- **Supabase**: Postgres relacional encaixa perfeitamente no nosso domínio ("quem compartilhou
  qual nota com quem", permissões) e o **Realtime** oferece exatamente os três modos que
  precisamos — *Postgres Changes* (sincronizar a nota), *Presence* (quem está online) e
  *Broadcast* (disparar o lembrete chamativo ao vivo). **Free tier:** ~200 conexões simultâneas
  de pico e ~2 milhões de mensagens/mês — folgado para R5.
- **Firebase**: robusto, mas NoSQL torna o modelo de compartilhamento relacional mais chato, o
  billing não tem teto e o lock-in é alto. Descartado.
- **PocketBase**: 1 binário Go + SQLite, sobe em minutos, custo fixo — excelente **alternativa
  self-hosted** se o objetivo for controle total/custo previsível. Limite: SQLite num único
  servidor; se o app crescer muito, migra. Para R5 é mais que suficiente.

### Decisão da camada de backend

> **Supabase** como padrão (Postgres + Auth + Realtime + Row Level Security).
> **PocketBase** documentado como alternativa self-hosted de custo fixo.

Por quê: cobre R4 (realtime real e pronto), R5 (free tier folgado), R6 (Postgres + RLS crescem
sem reescrita) e evita o lock-in do Firebase.

## 4. Stack recomendada — resumo

```
┌───────────────────────────────────────────────────────────────┐
│  FRONTEND (um único codebase)                                  │
│  React 18 + TypeScript + Vite                                  │
│  Tailwind CSS (theming preto/cinza/amarelo por tokens)         │
│  Zustand (estado leve)  ·  TanStack Query (sync de dados)      │
│  Framer Motion (animações "chamativas")                        │
│  vite-plugin-pwa (installable + offline)                       │
└───────────────┬───────────────┬───────────────┬───────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────────┐
        │  Windows     │ │  Android     │ │  Web           │
        │  Tauri 2     │ │  Tauri 2     │ │  PWA (Vite)    │
        │  overlay/    │ │  (ou Capacitor│ │  Vercel/       │
        │  always-on-  │ │   plano B)   │ │  Netlify/CF    │
        │  top + tray  │ │  notif. alta │ │  Pages         │
        └───────┬──────┘ └──────┬───────┘ └─────┬──────────┘
                └───────────────┼───────────────┘
                        ┌───────▼────────────────────────────┐
                        │  BACKEND — Supabase                 │
                        │  Postgres + RLS (dados/permissões)  │
                        │  Auth (e-mail, magic link, OAuth)   │
                        │  Realtime: Changes/Presence/Broadcast│
                        │  Storage (anexos, futuro)           │
                        └─────────────────────────────────────┘
```

### Bibliotecas de apoio (por que cada uma)
- **Vite** — dev server e HMR muito rápidos → "fluido" para desenvolver (R2).
- **Tailwind** — theming por tokens torna a paleta preto/cinza/amarelo trivial e consistente
  entre plataformas (ver [`../design/design-tokens.md`](../design/design-tokens.md)).
- **Zustand** — estado global mínimo, sem a cerimônia do Redux; adequado ao tamanho do app.
- **TanStack Query** — cache + sincronização com o Supabase, revalidação e offline-friendly.
- **Framer Motion** — as animações de entrada "chamativas" dos lembretes (R3).
- **vite-plugin-pwa** — service worker, instalável e offline básico "de graça" na Web.
- **@tauri-apps/plugin-notification** — notificações nativas em desktop e Android (agendamento,
  canais, ações).

## 5. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Android no Tauri 2 ainda amadurecendo | Médio | Manter front React desacoplado da casca; plano B = Capacitor para Android |
| Curva de Rust no Tauri | Baixo | O núcleo é web; Rust só para comandos nativos pontuais (overlay, tray, alarme) |
| Free tier do Supabase (pausa de projeto se inativo) | Baixo (app pequeno) | Manter atividade mínima; migrar para PocketBase self-host se necessário |
| "Chamativo na tela" no Android tem restrições do SO (full-screen intent exige permissão) | Médio | Usar canais de notificação de alta prioridade + permissão de alarme exato; documentar limites |

## 6. Decisão em aberto (a confirmar antes do scaffold)

A **única** escolha que muda o rumo do desenvolvimento é a casca nativa:

- **Opção recomendada:** Tauri 2 para Windows **e** Android (mais leve, um só empacotador).
- **Opção conservadora:** Tauri/Electron no Windows + Capacitor no Android (mais maduro no
  Android, dois empacotadores).

Em ambas, **o frontend React e o backend Supabase são idênticos** — por isso a pesquisa e o
escopo seguem sem depender dessa resposta. Ela só precisa ser travada no início da Fase 1
(ver [`04-roadmap.md`](04-roadmap.md)).
