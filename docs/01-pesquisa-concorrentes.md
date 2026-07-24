# 01 — Pesquisa de Concorrentes e Referências

Objetivo: mapear sistemas que cumprem função semelhante à do **SB Notas** para entender o que
já existe, o que funciona, e onde há espaço para diferenciação. As fontes completas estão em
[`05-fontes.md`](05-fontes.md).

## 1. Panorama do mercado

Os concorrentes se dividem em três grandes famílias. Nenhum entrega as três ao mesmo tempo —
é justamente aí que o SB Notas se posiciona.

| Família | O que faz bem | O que falta |
|---|---|---|
| **Sticky notes de desktop** (Notezilla, Stickies, Sticky Notes do Windows) | Notas *sempre no topo*, alarmes em popup chamativo, presença física na tela | Compartilhamento colaborativo real é fraco ou inexistente; customização limitada |
| **Notas/lembretes colaborativos** (Google Keep, Remember The Milk, Microsoft To Do, TickTick, Todoist) | Compartilhar listas/notas, lembretes por horário, multiplataforma | Não "invadem" a tela — vivem num app que você precisa abrir; pouca personalização visual |
| **Workspaces de conhecimento** (Notion, OneNote, Standard Notes, Simplenote) | Colaboração rica, estrutura, multiplataforma | Pesados para o caso "lembrete rápido e chamativo"; overkill para o objetivo |

## 2. Concorrentes analisados

### Notezilla — *o mais próximo do conceito*
Sticky notes para Windows, Android, iPhone/iPad, Mac e Web App. Referência direta em vários
pontos que o SB Notas quer:
- Notas **"Stay on top"** — sempre visíveis sobre os outros apps.
- Ao disparar um alarme, mostra um **popup chamativo** com a nota real (não só uma notificação).
- **Sincronização** entre PC e celular; lembrete também por e-mail.

**Forças:** exatamente o comportamento "chamativo na tela" que queremos.
**Fraquezas para nós:** é proprietário/pago, o foco é produtividade individual — o
**compartilhamento colaborativo em tempo real** entre usuários não é o coração do produto.
**Aprendizado:** o "popup com a nota inteira" + "always on top" é o padrão de UX a replicar no desktop.

### Google Keep
Captura rápida, cores, checklists, lembretes por hora/local e **compartilhamento de notas**
com colaboração em tempo real. Gratuito.
**Forças:** simplicidade, compartilhamento fácil, colaboração ao vivo.
**Fraquezas:** notas ficam presas dentro do app; personalização visual limitada a poucas cores;
não há "modo chamativo" na tela.

### Remember The Milk
Permite **compartilhar listas** com outros usuários e editá-las colaborativamente — bom modelo
de compartilhamento de lista/tarefa.
**Aprendizado:** modelo de "lista compartilhada com permissões" é uma boa referência de dados.

### Microsoft To Do / TickTick / Todoist
Gestão de tarefas robusta, lembretes (TickTick suporta múltiplos lembretes por tarefa),
listas compartilhadas, multiplataforma.
**Fraquezas para nós:** são *task managers* — o eixo é a lista de tarefas, não o lembrete
visual e customizável.

### Notion / OneNote
Workspaces colaborativos completos. Notion é a referência de "web + desktop (Electron) +
mobile (React Native) com o mesmo produto" — modelo que inspira nossa distribuição
multiplataforma (ver [`02-pesquisa-stack.md`](02-pesquisa-stack.md)).
**Fraquezas para nós:** pesados; abrir o Notion para deixar um lembrete rápido é fricção demais.

### Simplenote / Standard Notes
Minimalistas, gratuitos, open-source (Simplenote com colaboração em tempo real; Standard Notes
com criptografia ponta-a-ponta).
**Aprendizado:** referência de "leveza" e, no Standard Notes, de privacidade/criptografia
como possível diferencial futuro.

## 3. Matriz comparativa

| App | Chamativo na tela | Customização por nota | Compartilhar / colaborar | Leve | Win + Android + Web |
|---|:---:|:---:|:---:|:---:|:---:|
| Notezilla | ✅ forte | 🟡 média | 🟡 fraco | ✅ | ✅ |
| Google Keep | ❌ | 🟡 cores | ✅ tempo real | ✅ | ✅ |
| Remember The Milk | ❌ | ❌ | ✅ listas | ✅ | ✅ |
| MS To Do / TickTick / Todoist | ❌ | ❌ | ✅ | ✅ | ✅ |
| Notion / OneNote | ❌ | ✅ rica | ✅ rica | ❌ pesado | ✅ |
| **SB Notas (alvo)** | ✅ **núcleo** | ✅ **núcleo** | ✅ **núcleo** | ✅ | ✅ |

## 4. O gap — onde o SB Notas ganha

Nenhum concorrente entrega **simultaneamente**:

1. **Presença chamativa** — o lembrete aparece de forma impossível de ignorar
   (overlay always-on-top no desktop; notificação em tela cheia / alarme no Android),
   herdando o melhor do Notezilla.
2. **Customização por lembrete** — cor, tamanho, estilo, urgência, animação de entrada —
   algo que Keep e os task managers não oferecem.
3. **Compartilhamento colaborativo em tempo real** — outra pessoa vê o mesmo lembrete
   aparecer para ela, herdando o melhor do Keep/RTM.
4. **Leveza e fluidez** — sem o peso do Notion; abrir e criar um lembrete é instantâneo.

Posicionamento em uma frase:

> **SB Notas = a presença "na sua cara" do Notezilla + o compartilhamento em tempo real do
> Google Keep + a customização que nenhum dos dois tem — num app leve.**

## 5. Implicações de produto (o que trazer para o escopo)

- **Desktop:** janela overlay *always-on-top* + popup com a nota inteira ao disparar (não só toast).
- **Android:** notificação de alta prioridade / full-screen intent + alarme; widget de tela inicial (futuro).
- **Compartilhamento:** modelo pessoa→pessoa com permissão (ver/editar), evoluindo para
  grupos/quadros compartilhados. Sincronização em **tempo real**.
- **Customização** como cidadã de primeira classe do modelo de dados (campo `style` por nota).
- **Leveza** como requisito não-funcional explícito (ver [`03`](03-arquitetura-escopo.md)).
