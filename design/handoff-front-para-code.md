# Handoff front → code — SB Notas

> Ponte entre o **protótipo de front** (`SB Notas.dc.html`, na raiz do projeto) e a
> implementação da **Fase 1** na stack decidida em [`../docs/02-pesquisa-stack.md`](../docs/02-pesquisa-stack.md):
> **React 18 + TypeScript + Vite · Tailwind · Zustand · TanStack Query · Framer Motion**,
> casca **Tauri 2** (Win/Android) + **PWA** (Web), backend **Supabase**.
>
> O protótipo é a fonte de verdade **visual e de interação**. Este documento traduz o que
> ele mostra em estrutura de código: tokens → `tailwind.config`, telas → rotas, componentes →
> árvore React com props, e o estado/tempo-real por trás do disparo.

---

## 0. O que o protótipo cobre (e o que não)

Implementado e navegável no protótipo:
- **Auth** (login / magic link — mockado, o botão só entra no app).
- **Mural** — grade masonry de cards, abas Ativos/Agendados/Arquivados, busca, estado vazio.
- **Editor** — modal (desktop) / tela cheia (mobile): título, corpo, cor, prioridade, fixar,
  data/hora, recorrência, compartilhar, **prévia ao vivo** e botão "testar disparo".
- **Overlay de disparo** — a assinatura: glow + pulso (3 batidas), *shake* extra em Urgente,
  ações Concluir / Adiar / Abrir, avatares de quem também recebe.
- **Pessoas** — convites, lista de compartilhamento com presença (online / visto há).
- **Ajustes** — toggles de notificação/permissão/aparência.
- Alternador **Desktop ⇄ Mobile** e botão **Simular disparo** (pílula flutuante) — são
  **andaimes do protótipo**, não fazem parte do produto; remover na implementação.

Fora do protótipo (implementar no código): autenticação real, persistência, agendamento
real dos disparos, realtime multiusuário, permissões (RLS), notificações nativas, PWA/offline.

---

## 1. Tokens → `tailwind.config.ts`

Copiar de [`design-tokens.md`](design-tokens.md). Sugestão de config (nomes batem com o protótipo):

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg:       { base:'#0A0A0B', surface:'#141417', elevated:'#1C1C21', 'elevated-2':'#26262E' },
        border:   { DEFAULT:'#2E2E38', strong:'#3A3A46' },
        text:     { primary:'#F4F4F5', secondary:'#A1A1AA', muted:'#71717A', 'on-accent':'#0A0A0B' },
        accent:   { DEFAULT:'#FACC15', hover:'#EAB308', soft:'#FDE047' },
        success:'#22C55E', warning:'#F59E0B', danger:'#EF4444', info:'#60A5FA',
      },
      borderRadius: { sm:'8px', md:'12px', lg:'16px', xl:'20px' }, // cards = lg
      boxShadow: {
        card:'0 2px 8px rgba(0,0,0,.4)',
        pop:'0 12px 40px rgba(0,0,0,.6)',
        glow:'0 0 0 2px #FACC15, 0 0 32px rgba(250,204,21,.45)',
      },
      keyframes: {
        popIn:       { '0%':{opacity:0,transform:'scale(.9)'}, '100%':{opacity:1,transform:'scale(1)'} },
        overlayPulse:{ '0%,100%':{boxShadow:'0 0 0 2px #FACC15, 0 0 24px rgba(250,204,21,.30)'},
                       '50%':{boxShadow:'0 0 0 3px #FDE047, 0 0 56px rgba(250,204,21,.65)'} },
        shakeX:      { '0%,100%':{transform:'translateX(0)'}, '20%':{transform:'translateX(-9px)'},
                       '40%':{transform:'translateX(8px)'}, '60%':{transform:'translateX(-5px)'}, '80%':{transform:'translateX(3px)'} },
      },
      animation: {
        popIn:'popIn .3s cubic-bezier(.16,1,.3,1) both',
        overlayPulse:'overlayPulse 1.1s ease-in-out 3',
        shakeX:'shakeX .5s cubic-bezier(.36,.07,.19,.97) both',
      },
    },
  },
  darkMode:'class', // app é dark-only: aplicar `dark` no <html> e não oferecer light na Fase 1
}
```

**Cores de card por nota** (customização do usuário) — expor como constante, não como token de tema:
`['#FACC15','#F59E0B','#EF4444','#22C55E','#60A5FA','#A78BFA','#F472B6','#94A3B8']`.
Regra: a cor vai na **borda/faixa** do card (`border-l-4`), nunca no fundo inteiro.

> **Framer Motion** deve dirigir as animações do disparo (não os `@keyframes` acima) para
> ter controle de sequência (entrada → pulso ×3 → parar) e respeitar `prefers-reduced-motion`
> via `useReducedMotion()`. Os keyframes ficam como fallback CSS.

---

## 2. Telas → rotas

Web/PWA usa router; desktop/mobile renderizam as mesmas rotas dentro da casca.

| Rota | Tela | Componente-topo |
|---|---|---|
| `/login` | Auth | `<AuthScreen>` |
| `/` | Mural | `<AppShell><MuralScreen>` |
| `/pessoas` | Pessoas | `<AppShell><PeopleScreen>` |
| `/ajustes` | Ajustes | `<AppShell><SettingsScreen>` |
| _(overlay)_ | Editor | `<ReminderEditor>` — modal sobre a rota atual |
| _(janela/overlay nativo)_ | Disparo | `<TriggerOverlay>` — ver §5 |

`<AppShell>` = layout responsivo: **Sidebar** (desktop) ou **BottomNav** + **FAB** (mobile),
com **Topbar** (título + busca no Mural). No protótipo isso é o alternador Desktop/Mobile;
em produção use a largura real / `matchMedia` (Tailwind `md:`).

---

## 3. Inventário de componentes (kit)

Nomes prontos para virar arquivos `.tsx`. Props derivadas do comportamento do protótipo.

### Layout
- **`AppShell`** `{ children }` — grelha responsiva sidebar/bottom-nav + topbar.
- **`Sidebar`** `{ active, counts }` — marca, botão "Novo lembrete", nav, rodapé de conta.
- **`BottomNav`** `{ active }` + **`FabNewReminder`** `{ onClick }` (mobile).
- **`Topbar`** `{ title, showSearch, query, onQuery }`.

### Mural
- **`ReminderCard`** `{ reminder, onOpen }` — masonry via CSS `columns` (`column-width:260px`) e
  `break-inside:avoid`; borda esquerda = `reminder.color`; slots: `PriorityBadge`, hora,
  `AvatarStack`, ícone de fixado. **Variações** (todas no protótipo): normal · importante ·
  urgente · compartilhado · fixado.
- **`FilterTabs`** `{ value, counts, onChange }` — Ativos/Agendados/Arquivados.
- **`SearchBar`** `{ value, onChange }`.
- **`EmptyState`** `{ onCreate }`.
- **`PriorityBadge`** `{ priority }` — `normal|important|urgent` → `{label,icon,color}`.
- **`AvatarStack`** `{ people, size }` — avatares empilhados com `-ml` e borda do fundo.
- **`Avatar`** `{ initials, color, presence? }`.

### Editor
- **`ReminderEditor`** `{ reminder|null, onSave, onClose }` — modal/tela cheia; layout 2 colunas
  (form + **prévia**) no desktop, empilhado no mobile.
- **`ColorPicker`** `{ value, onChange }` — 8 swatches (cores de card).
- **`PrioritySelector`** `{ value, onChange }` — 3 botões segmentados.
- **`Toggle`** `{ checked, onChange }` — usado em Fixar e em Ajustes.
- **`DateTimeField`** `{ date, time, onChange }` + **`RecurrenceChips`** `{ value, onChange }`
  (`once|daily|weekly|monthly`).
- **`ShareSection`** `{ people, onAdd, onChangePerm }` + **`PermissionBadge`** `{ perm }` (Ver/Editar).
- **`ReminderPreview`** `{ draft }` — reusa `ReminderCard` com o rascunho ao vivo.

### Disparo & feedback
- **`TriggerOverlay`** `{ reminder, onComplete, onSnooze, onOpen }` — ver §5.
- **`Toast`** `{ message }` — confirmações ("Lembrete criado", "Concluído", "Adiado").

### Ajustes / Pessoas
- **`SettingsGroup`** / **`SettingRow`** `{ icon, label, desc, checked, onToggle }`.
- **`PersonRow`** `{ person, perm }`, **`InviteRow`**, **`InviteField`**.

**Ícones:** o protótipo usa **Lucide** — manter `lucide-react` no código
(bell, layout-grid, users, settings, search, plus, pin, share-2, check, clock, alarm-clock,
flag, alert-triangle, zap, x, maximize-2, log-out, sparkles, monitor, smartphone).

---

## 4. Estado (Zustand) + dados (TanStack Query)

Formato usado pelo protótipo (bom ponto de partida para os tipos):

```ts
type Priority = 'normal' | 'important' | 'urgent';
type Status   = 'active' | 'scheduled' | 'archived';
type Perm     = 'view' | 'edit';

interface Reminder {
  id: string;
  title: string;
  body: string;
  color: string;                 // hex das 8 cores de card
  priority: Priority;
  pinned: boolean;
  remindAt: string;              // ISO — protótipo mostra string já formatada
  recurrence: 'once'|'daily'|'weekly'|'monthly';
  status: Status;
  ownerId: string;
  shares: { userId: string; initials: string; name: string; color: string; perm: Perm }[];
}
```

- **Zustand** — UI/efêmero: `screen`, `activeTab`, `searchQuery`, `editorDraft`, `activeTrigger`,
  `settings`. (No protótipo tudo isso vive em `this.state`.)
- **TanStack Query** — dados do servidor: `useReminders(tab)`, `useCreateReminder()`,
  `useUpdateReminder()`, `usePeople()`. Ordenação do mural: fixados primeiro, depois por `remindAt`.
- Filtros/busca do mural são derivados (memo) de `reminders + tab + query`, exatamente como
  o `renderVals()` do protótipo faz.

---

## 5. O disparo — a parte que o protótipo só simula

No protótipo o botão "Simular disparo" apenas abre `<TriggerOverlay>`. Em produção o disparo
tem três responsabilidades, uma por plataforma (ver R3 em [`../docs/02-pesquisa-stack.md`](../docs/02-pesquisa-stack.md)):

1. **Agendamento** — ao salvar, agendar via `@tauri-apps/plugin-notification` (desktop/Android)
   e um timer no app quando aberto. Recorrência gera as próximas ocorrências.
2. **Apresentação chamativa**
   - **Windows (Tauri):** janela dedicada **always-on-top**, centralizada, sem borda, contendo
     `<TriggerOverlay>` com a nota inteira, glow + pulso (Framer Motion). Urgente → `shakeX` inicial.
   - **Android:** canal de notificação de **alta prioridade** + full-screen intent (exige
     permissão de alarme exato); a tela de alarme reusa `<TriggerOverlay>`.
   - **Web/PWA:** Notification API + o overlay in-app quando a aba está aberta.
3. **Tempo real (Supabase Realtime)** — quando um lembrete compartilhado dispara, um evento
   **Broadcast** faz o `<TriggerOverlay>` aparecer **para todos** os participantes ao vivo;
   **Presence** alimenta o "visto por / online" das telas Pessoas e do overlay; **Postgres
   Changes** sincroniza edições da nota. Ações do overlay (Concluir/Adiar) propagam pelo mesmo canal.

`prefers-reduced-motion` (e o toggle "Reduzir movimento" em Ajustes) desliga pulso e shake —
já modelado no protótipo pela flag `settings.reduce`.

---

## 6. Supabase — esboço de schema (para RLS de compartilhamento)

```sql
reminders ( id, owner_id, title, body, color, priority, pinned,
            remind_at, recurrence, status, created_at )
reminder_shares ( reminder_id, user_id, perm )   -- perm: 'view' | 'edit'
profiles ( id, name, initials, color )
```

RLS: dono lê/escreve tudo o seu; participante lê se houver linha em `reminder_shares`,
edita apenas se `perm='edit'`. Canais Realtime por `reminder_id` para o disparo compartilhado.

---

## 7. Checklist de paridade com o protótipo

- [ ] Tokens no `tailwind.config` batem com [`design-tokens.md`](design-tokens.md) (contraste AA).
- [ ] Mural em 1 coluna (mobile) e masonry (desktop); abas + busca + estado vazio.
- [ ] Editor cobre cor, prioridade, fixar, data/hora, recorrência, compartilhar e prévia ao vivo.
- [ ] `<TriggerOverlay>` com glow + pulso (3 batidas), shake em Urgente, e as 3 ações.
- [ ] Captura rápida em ≤ 1 ação (botão sidebar / FAB / atalho global no desktop).
- [ ] Estados: vazio, carregando, erro, compartilhado, disparando.
- [ ] `prefers-reduced-motion` + toggle "Reduzir movimento" removem pulso/shake.
- [ ] Remover os andaimes do protótipo (alternador de dispositivo, "Simular disparo").
```
