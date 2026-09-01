# 07 — Pesquisa de Apps Similares (Fase 5) e Backlog de Incrementos

> Atualiza e aprofunda a [`01-pesquisa-concorrentes.md`](01-pesquisa-concorrentes.md) (Fase 0),
> agora que o SB Notas já tem lembretes chamativos, tarefas com checklist, compartilhamento 1:1,
> quadros, comentários por nota, contatos com convite, notificações e temas. O foco aqui é
> **o que dá para incrementar** — features que os apps de referência fazem bem e que combinam
> com o nosso diferencial. Consultado em agosto/2026. Fontes ao final e em [`05-fontes.md`](05-fontes.md).

## 1. Onde o SB Notas se encaixa (mapa atualizado)

Além das três famílias da Fase 0 (sticky notes de desktop, notas/tarefas colaborativas, workspaces),
uma quarta família é a **mais próxima do nosso conceito** e não estava mapeada: os **alarmes
sociais / compartilhados que insistem**.

| Família | Representantes | O que faz bem | O gap que deixamos |
|---|---|---|---|
| Sticky notes chamativos | Notezilla, Sticky Notes | Popup com a nota inteira, *always-on-top* | Sem colaboração real |
| **Alarme social / de grupo** | **Galarm, Due** | Alarme compartilhado, participantes que te lembram, insistência (auto-snooze), chat no alarme, compartilhar por link | Visual pobre, sem web/desktop forte, sem customização por item |
| Calendário/organizador de família | TimeTree, Cozi, FamilyWall | Calendário compartilhado, listas, chat por evento, localização da família | Não "invadem" a tela; foco em agenda, não no lembrete chamativo |
| Tarefas & lembretes | TickTick, Todoist, Any.do | Linguagem natural, recorrência rica, hábitos, foco (pomodoro), voz | Vivem num app que você abre; sem presença chamativa |
| Planner do dia | Structured, TimeBloc | Timeline arrastável, time-blocking, subtarefas na linha | Individual, sem colaboração/chamativo |

**Leitura:** o SB Notas fica no cruzamento de **Galarm (social + insistente)** × **Notezilla
(chamativo na tela)** × **customização por item** — combinação que nenhum deles entrega junto.

## 2. Deep dives — o que roubar de cada um

### Galarm — *o primo mais próximo* (grátis · iOS/Android)
Alarme social: você cria um alarme e **adiciona participantes**; se você não responde, eles são
alertados para te lembrar. Tem **chat dentro do alarme**, recorrência (horária→anual) e
**compartilhamento por link** (manda o alarme no WhatsApp/e-mail).
→ **Incrementar:** (a) "participante que cobra" — se o dono não conclui um lembrete disparado,
notificar quem compartilha; (b) **convite/compartilhar por link**, além do e-mail; (c) já temos
chat por nota — reforça o alinhamento.

### Due — *a insistência* (pago · iOS/macOS)
Fama pelo **Auto Snooze persistente**: o lembrete **re-alerta a cada 1/5/10/15/30/60 min até
você concluir ou reagendar** — "pester until acknowledged". Recorrência complexa
(ex.: toda 3ª quarta do mês). Funciona offline, sem conta.
→ **Incrementar:** transformar nosso snooze fixo de 10 min em **auto-snooze configurável que
insiste** — casa perfeitamente com a proposta "impossível de ignorar". É o incremento de maior
aderência ao nosso núcleo.

### TimeTree — calendário compartilhado (grátis · iOS/Android/Web)
Calendários ilimitados, cada um com membros e permissões; **chat por evento**, memos e to-dos
compartilhados, sync com Google/Apple/Outlook.
→ **Incrementar:** (a) **sync/export bidirecional** com calendários (já exportamos .ics — falta
importar/assinar); (b) o modelo "quadro = calendário com membros" já temos; (c) chat por evento ≈
nosso comentário por nota.

### Cozi / FamilyWall — organizador de família (freemium)
Calendário + **listas de compras com seções** (PRODUCE/DAIRY, arrastar itens), **meal planner +
caixa de receitas** (ingrediente vira item da lista com 1 toque), listas coloridas por pessoa.
FamilyWall soma **localização em tempo real da família** e geofencing.
→ **Incrementar:** (a) **listas de compras** como um tipo de tarefa com **seções/cabeçalhos** e
reordenação — extensão barata do nosso checklist (já é tabela `note_checklist_items`); (b)
localização (ver §Localização); (c) meal planner/receitas provavelmente **fora de escopo**, mas
fica registrado.

### TickTick — tarefas + hábitos (freemium, Premium ~US$35,99/ano)
**Linguagem natural** (Smart Date Parsing tira data/hora do texto), **recorrência flexível**
("último Friday do mês", "a cada N dias"), **hábitos com streaks**, **pomodoro**, e calendário
com tarefas sobrepostas.
→ **Incrementar:** (a) **quick-add em linguagem natural** (§4); (b) **recorrência avançada** —
hoje só once/daily/weekly/monthly; (c) hábitos/streaks é gamificação opcional.

### Todoist — tarefas + colaboração (freemium)
**Quick Add** em linguagem natural (data + projeto + prioridade + label numa frase), **filtros e
labels** poderosos, **Karma** (gamificação por streak), colaboração (compartilhar projeto,
atribuir, comentar). Em 2026 lançou **voz (Ramble)** que transforma fala solta em tarefas.
→ **Incrementar:** (a) **labels/filtros** — já temos tags; falta filtro salvo/combinado; (b)
**atribuir item a alguém** (nosso checklist já registra quem concluiu — falta *assignee*); (c)
Karma/streak opcional.

### Any.do — planner + integrações (freemium)
**Plan My Day** (ritual diário guiado), **listas compartilhadas**, **captura via WhatsApp**,
lembrete por localização, subtarefas, anexos. Forte em integrações (Calendar, Slack, Gmail).
→ **Incrementar:** (a) **captura rápida por canal externo** (ex.: bot/URL para criar lembrete);
(b) subtarefas ≈ nosso checklist.

### Structured — planner do dia (freemium)
**Timeline arrastável** do dia (time-blocking), inbox de captura, **subtarefas direto na linha**,
pomodoro, widgets, cores.
→ **Incrementar:** uma **visão "Hoje" em timeline** dos lembretes com horário — complementa o
mural sem substituí-lo.

## 3. Matriz — o que já temos vs. o que dá para incrementar

| Capacidade | Ref. principal | SB Notas hoje | Incremento |
|---|---|:---:|---|
| Presença chamativa (overlay) | Notezilla/Due | ✅ | Auto-snooze que insiste |
| Compartilhar em tempo real | Keep/TimeTree | ✅ | Compartilhar **por link** |
| Chat por item | Galarm/TimeTree | ✅ (comentários) | — |
| Notificações de atividade | todos | ✅ | — |
| Checklist com autoria | Cozi | ✅ (por item + quem concluiu) | Seções + **assignee** |
| Recorrência | TickTick/Due | 🟡 (4 tipos) | **Recorrência avançada** |
| Linguagem natural | TickTick/Todoist | ❌ | **Quick-add (chrono)** |
| Lembrete por localização | Any.do/Apple | ❌ (planejado) | **Geofencing (Android)** |
| Listas de compras | Cozi | 🟡 (checklist) | Seções/cabeçalhos |
| Widgets home screen | TickTick/Structured | ❌ | Widget Android |
| Timeline do dia | Structured | ❌ | Visão "Hoje" |
| Gamificação (streak/karma) | Todoist/TickTick | ❌ | Opcional |
| Voz para criar | Todoist Ramble | ❌ | Futuro |

## 4. Backlog priorizado de incrementos

Ordenado por **aderência ao núcleo × baixo esforço**. Os primeiros são os que mais "cabem" no
que já existe.

**Alto valor, baixo/médio esforço (fazer cedo):**
1. **Auto-snooze persistente** — o disparo re-alerta a cada X min até concluir/reagendar (Due).
   Reforça o "impossível de ignorar". Só mexe no `ReminderScheduler`/`TriggerOverlay` + um campo
   por lembrete. **Maior aderência ao produto.**
2. **Quick-add em linguagem natural** — campo "Lembrar amanhã 14h de ligar pro dentista" que já
   preenche data/hora via [`chrono-node`](https://www.npmjs.com/package/chrono-node) (pt parcial;
   dá para reforçar com regras próprias). Tira fricção da criação.
3. **Recorrência avançada** — "a cada N dias", "toda última sexta", dias da semana específicos
   (TickTick/Due). Estende `recurrence` + `nextOccurrence` (já existe em `lib/reminders.ts`).
4. **Compartilhar por link** — convidar para uma nota/quadro por link, além do e-mail (Galarm).

**Médio esforço (próximas fases):**
5. **Lembrete por localização (geofencing)** — já planejado junto do Android/Capacitor.
6. **Listas de compras** — tipo de tarefa com **seções** e reordenar (Cozi); reusa o checklist.
7. **Atribuir item a alguém** (assignee) — o checklist já sabe *quem concluiu*; falta *quem deve*.
8. **Widget de home screen (Android)** — lembretes de hoje na tela inicial.
9. **Visão "Hoje" em timeline** — agenda do dia dos lembretes com horário (Structured).

**Opcional / futuro:**
10. Gamificação leve (streak de conclusão) · 11. Filtros salvos sobre tags · 12. Import/assinatura
    de calendário (.ics de entrada) · 13. Criação por voz · 14. Meal planner/receitas (provável fora de escopo).

## 5. Posicionamento reforçado

> **SB Notas = o alarme social e insistente do Galarm/Due + a presença "na sua cara" do Notezilla
> + a customização por item que nenhum deles tem — leve, em Windows + Web + Android.**

O que nos mantém únicos depois destes incrementos: continuar sendo **o único** que junta
**chamativo na tela + compartilhamento em tempo real + customização por lembrete** num app leve.
Os incrementos 1–4 acima aprofundam exatamente esse fosso, sem virar "mais um task manager".

## 6. Fontes (agosto/2026)

**Alarme social / insistência**
- Galarm — Features: https://www.galarmapp.com/features
- Galarm — Google Play: https://play.google.com/store/apps/details?id=com.galarmapp
- Due — site oficial: https://www.dueapp.com/
- Due — Fine-tuning reminders (auto-snooze): https://www.dueapp.com/support/osx/fine-tuning-reminders.html
- yougot.ai — Snooze-proof reminder apps: https://www.yougot.ai/blog/reminders/general-reminders/snooze-proof-reminder-app

**Calendário/organizador de família**
- TimeTree — Help (shared calendar): https://support.timetreeapp.com/hc/en-us/articles/900004492623-How-to-use-shared-calendar-app
- TimeTree — App Store: https://apps.apple.com/us/app/timetree-shared-calendar/id952578473
- Cozi — Shopping Lists: https://www.cozi.com/shopping-lists/
- Cozi — Meals & Recipe Box: https://www.cozi.com/meals-and-recipe-box/
- Cozi — Gold Features: https://www.cozi.com/cozi-gold-features/
- FamilyWall — Location sharing: https://support.familywall.com/en/support/solutions/articles/47001239510-share-your-location-with-one-or-several-members
- Homsy — Best Family Organizer Apps 2026: https://gethomsy.com/blog/comparisons/best-family-organizer-apps-2026

**Tarefas & lembretes**
- TickTick — Review 2026: https://work-management.org/tasks/ticktick-review/
- TickTick — Google Play: https://play.google.com/store/apps/details?id=com.ticktick.task
- Todoist — Features Review 2026: https://thesoftwarefeatures.com/todoist-features-review-2026/
- Todoist — Tutorial 2026: https://www.geeky-gadgets.com/organize-tasks-todoist/
- Any.do — Reminders: https://www.any.do/reminders
- Any.do — Best AI Daily Planner 2026: https://www.any.do/blog/the-best-ai-daily-planner-app-in-2026-why-any-do-stands-out/
- Structured — App Store: https://apps.apple.com/us/app/structured-daily-planner-todo/id1499198946
- Structured — Review 2026: https://daveswift.com/structured/

**Linguagem natural / localização**
- chrono-node — npm: https://www.npmjs.com/package/chrono-node
- chrono — GitHub (wanasit): https://github.com/wanasit/chrono
- Google Keep — location reminders (9to5Google): https://9to5google.com/2019/11/04/set-up-location-reminders-google-keep/
- Apple — Managing location-based reminders: https://developer.apple.com/documentation/eventkit/managing-location-based-reminders
- GeoNote — geofencing reminders: https://geonote.net/en/

**Panoramas de reminder apps**
- ClickUp — 10 Best Reminder Apps 2026: https://clickup.com/blog/best-reminder-apps/
- Saner.ai — Best Reminder Apps 2026: https://blog.saner.ai/best-reminder-apps/
- NagMeLater — Best Reminder Apps for Android 2026: https://nagmelater.com/blog/best-reminder-apps-android.html
