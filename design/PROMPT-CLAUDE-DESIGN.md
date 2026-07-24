# Prompt para construção do front — SB Notas

> **Como usar:** aponte o Claude (modo design / Figma / artifacts) para esta pasta `design/`.
> Este arquivo é o briefing; [`design-tokens.md`](design-tokens.md) tem as cores/tipografia
> exatas e [`referencias.md`](referencias.md) as inspirações. O contexto completo de produto e
> arquitetura está em [`../docs/`](../docs/00-README.md).

---

## Prompt (cole isto para o Claude de design)

Você vai desenhar e construir o **front-end do SB Notas**, um sistema de lembretes
multiusuário. Siga estritamente os arquivos desta pasta `design/`:
use os tokens de [`design-tokens.md`](design-tokens.md) como fonte única de cores, tipografia,
raios, sombras e movimento, e as [`referencias.md`](referencias.md) como norte estético.
**Não invente uma paleta nova** — a identidade é dark em tons de preto/cinza com destaque em
amarelo âmbar (`#FACC15`).

### O produto em uma frase
Um app leve onde a pessoa escreve lembretes próprios, **customiza** como eles aparecem, eles
surgem de forma **chamativa** na tela, e podem ser **compartilhados em tempo real** com outras
pessoas — que veem o mesmo lembrete aparecer.

### Plataformas e responsividade
O **mesmo** front roda em três lugares — desenhe pensando nos três:
- **Windows (desktop):** janela do app + um **overlay de disparo** que aparece por cima de tudo.
- **Android (mobile):** layout de uma coluna, alvos de toque ≥ 44px, gestos.
- **Web (PWA):** instalável, responsivo de mobile a desktop.
Adote **mobile-first** e expanda para desktop. Não desenhar para iOS.

### Princípios de UX
1. **Calmo por padrão, elétrico no disparo.** A UI do dia a dia é sóbria (preto/cinza, muito
   respiro). O amarelo com glow/pulso é reservado ao momento em que um lembrete dispara.
2. **Criar um lembrete em ~1 segundo.** Captura rápida sempre à mão (botão flutuante / atalho).
3. **Leveza é feature.** Nada de telas pesadas; hierarquia clara, poucos cliques.
4. Respeitar `prefers-reduced-motion` e contraste AA (ver tokens).

### Telas a projetar (MVP)

1. **Autenticação** — login/cadastro (e-mail + senha; botão "magic link"). Minimalista,
   logo "SB Notas", card central sobre fundo `bg-base`, CTA em `accent`.

2. **Mural de lembretes (tela principal)** — grade de **cards** (estilo masonry, à la Keep):
   - Card mostra título, trecho do corpo, cor de acento (borda/faixa), hora agendada, badge de
     prioridade e ícone de "compartilhado" (avatares empilhados).
   - Filtros/abas: Ativos · Agendados · Arquivados. Busca no topo.
   - **Botão de captura rápida** flutuante (FAB no mobile; barra/atalho no desktop).
   - Estado vazio acolhedor ("Nenhum lembrete ainda — crie o primeiro").

3. **Editor de lembrete** (modal no desktop / tela cheia no mobile):
   - Título, corpo. Seletor de **cor** (paleta de card dos tokens). Seletor de **prioridade**
     (Normal / Importante / Urgente). Toggle **fixar**.
   - Seção **Lembrar em**: data/hora, e (marcar como futuro) recorrência/snooze.
   - Seção **Compartilhar com**: buscar pessoa + permissão (Ver / Editar); lista de com quem
     já está compartilhado.
   - Prévia ao vivo do card enquanto edita.

4. **Overlay de disparo (a assinatura do produto)** — quando um lembrete dispara:
   - No desktop: janela **sempre no topo**, centralizada, com a **nota inteira**, glow amarelo
     e **pulso** (2–3 batidas). Urgência 2 adiciona leve *shake* inicial.
   - No Android: cartão de notificação de alta prioridade + tela de alarme equivalente.
   - Ações: **Concluir**, **Adiar** (snooze), **Abrir**. Grande, óbvio, difícil de ignorar.

5. **Compartilhamento / pessoas** — telinha para gerenciar com quem você compartilha e
   convites recebidos; indicador de **presença** (online / "visto por") como elemento futuro.

6. **Configurações** — conta, notificações/permissões (alarme, always-on-top), tema, sobre.

### Componentes-chave (crie um kit)
Card de lembrete (com variações: normal / importante / urgente / compartilhado / disparando),
FAB de captura, seletor de cor, seletor de prioridade, campo data/hora, chip de pessoa/avatar,
badge de permissão, barra de busca, abas de filtro, overlay de disparo, toast/notificação,
estado vazio, sidebar/nav (desktop) + bottom-nav (mobile).

### Entregáveis esperados
- Um **kit de componentes** e as **telas** acima, em light-out (dark) usando os tokens.
- Versões **mobile e desktop** das telas principais (mural, editor, overlay).
- O **overlay de disparo** caprichado — é o momento que define o produto.
- Se possível, protótipo navegável (mural → editor → salvar → simular disparo → overlay).

### Restrições
- Somente os tokens de [`design-tokens.md`](design-tokens.md); amarelo é destaque, não fundo.
- Tema **dark** como padrão (não priorizar light).
- Componentes pensados para virar **React + Tailwind** na Fase 1 (nomes/estrutura reutilizáveis).
- Acessibilidade: foco visível, contraste AA, não comunicar urgência só por cor.

---

## Checklist de aprovação do design
- [ ] Paleta bate exatamente com [`design-tokens.md`](design-tokens.md).
- [ ] Mural funciona em 1 coluna (mobile) e em grade (desktop).
- [ ] Editor cobre cor, prioridade, pin, agendar e compartilhar.
- [ ] Overlay de disparo é inequivocamente "chamativo" (glow + pulso) e acessível.
- [ ] Captura rápida acessível em ≤ 1 ação.
- [ ] Estados: vazio, carregando, erro, compartilhado, disparando.
- [ ] Componentes nomeados de forma reaproveitável para React + Tailwind.
