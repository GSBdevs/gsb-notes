# 09 — Pesquisa: aba de Blocos de anotação

Objetivo: avaliar como adicionar ao SB Notas uma **aba de blocos de anotação** — um editor de texto
rico em **blocos** (parágrafos, títulos, listas, to-dos, citações, divisórias…) no estilo Notion,
que se arrastam, reordenam e trocam de tipo. Consultado em ago/2026. Fontes ao final.

## 1. O modelo "tudo é bloco" (Notion)

A ideia central do Notion: **cada pedaço de conteúdo é um bloco** — parágrafo, título, imagem,
to-do, até uma página — todos o mesmo tipo de objeto, com `id`, `type`, `properties` e `content`
(filhos). Blocos podem ser **aninhados** (o `content` guarda os ids dos filhos), **reordenados**,
**copiados** e **transformados** em outro tipo sem perder dados (só muda o `type`; propriedades não
usadas pelo novo tipo são ignoradas). Aninhar = indentar (Tab vira filho do bloco acima).

Tipos básicos: página, to-do, títulos, listas (com marcador / numerada / toggle), citação,
divisória, callout, mídia (imagem, vídeo, código, arquivo). É esse vocabulário que uma "aba de
blocos" traria.

## 2. Bibliotecas para React (o editor)

Não vale a pena escrever um editor de blocos do zero (gerência de seleção, colar, undo, IME… é
notoriamente difícil). As opções maduras em 2026:

| Lib | O que é | Prós | Contras |
|---|---|---|---|
| **BlockNote** ⭐ | Editor **em blocos** pronto (sobre ProseMirror/TipTap), **React-first** | Estilo Notion **out-of-the-box**: slash menu, toolbar flutuante, arrastar, animações; saída em **JSON**; setup de 1–2h; colaboração opcional (Yjs) | Peso do ProseMirror; UI opinativa (dá para tematizar) |
| **TipTap** | Framework de editor (base do BlockNote) | Muito flexível; ecossistema grande | Blocos/arrastar você monta; mais trabalho |
| **Lexical** (Meta) | Framework de editor performático | Máxima customização; MIT | 4–6 semanas p/ chegar em "estilo Notion" (blocos + slash + dnd) |
| **Editor.js** | Editor de blocos clássico (JSON) | Simples, saída limpa em blocos | Menos "vivo"; ecossistema React fraco |

**Recomendação: BlockNote.** É o caminho mais rápido para um editor de blocos com a cara do Notion,
é React-first (nossa stack), e a **saída em JSON** encaixa direto no nosso modelo (guardar o
documento num `jsonb`). Casa com o requisito de **leveza/rapidez** de entrega — sem reinventar o editor.

## 3. Encaixe no SB Notas

Já temos a base perfeita: `notes` com `kind` e a coluna `style jsonb`. Duas decisões:

**(a) Onde os blocos vivem**
- **MVP recomendado:** um novo `kind = 'block'` (ou reusar `'doc'`), guardando o **documento
  BlockNote (array de blocos JSON)** numa coluna `content jsonb` (nova) — ou no próprio `style`.
  Reaproveita **tudo**: RLS, compartilhamento 1:1, quadros, comentários, anexos, realtime, contatos.
- **Evolução (não-MVP):** blocos como **linhas** (tabela `note_blocks` com `parent_id`, `position`,
  `type`, `props`) — dá sync por-bloco e colaboração fina, mas é bem mais complexo. Só se/quando a
  edição simultânea virar requisito. Começar pelo blob JSON é o certo.

**(b) Colaboração**
- MVP: salvar o documento inteiro no update da nota + realtime já existente (**last-write-wins**),
  como as tarefas. Cursor colaborativo / merge em tempo real (Yjs) fica para depois — é o pulo caro.

**(c) Aba nova vs. dentro de Tarefas**
- Opção 1: **nova aba "Blocos"** (rota `/blocos`) — documentos de anotação livres, separados dos
  lembretes e das tarefas. Mais claro conceitualmente.
- Opção 2: trocar o `textarea` de "Anotações" da Tarefa pelo editor de blocos — enriquece o que já
  existe, sem nova aba. Menos superfície, mas mistura tarefa e anotação.
- **Sugestão:** aba nova "Blocos" (é o que você pediu), reusando o editor também nas Tarefas depois.

## 4. Pontos de atenção

- **Bundle:** o ProseMirror/BlockNote é pesado → **lazy-load** o editor (chunk próprio, como já
  fazemos com as telas). Não pode entrar no bundle inicial.
- **Tema dark:** BlockNote aceita tema custom — alinhar aos nossos tokens (`tokens.css`).
- **Migração:** um `content jsonb` novo em `notes` é uma migração simples (`0018`).
- **Offline:** o blob JSON persiste no cache do Query como o resto; sem conflito de merge por ser
  documento único.

## 5. Esboço de escopo

1. Migração `0018`: `notes.content jsonb` (+ `kind 'block'`).
2. `blockService`/reuso do `notesService` (create/update carregando o JSON).
3. `BlockEditor` (BlockNote, lazy) tematizado; tela `/blocos` + item na navegação.
4. Reuso de comentários/anexos/compartilhamento (já prontos).
5. (futuro) tabela `note_blocks` + Yjs para edição simultânea.

Esforço: **médio** (a lib faz o trabalho pesado; o custo é integração + tema + migração).

## 6. Fontes (ago/2026)

- Notion — Exploring Notion's Data Model (block architecture): https://www.notion.com/blog/data-model-behind-notion
- Notion — Types of content blocks: https://www.notion.com/help/guides/types-of-content-blocks
- Notion API — Block reference: https://developers.notion.com/reference/block
- BlockNote — site oficial: https://www.blocknotejs.org/
- BlockNote — docs (introdução): https://www.blocknotejs.org/docs
- Liveblocks — Which rich text editor framework should you choose: https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025
- Eddyter — Build a Notion-Style Block Editor in React (2026): https://eddyter.com/blogs/build-notion-style-block-editor-react-2026
