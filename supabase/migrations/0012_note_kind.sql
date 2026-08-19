-- Tipo da nota (Fase 4 — módulo Tarefas). `kind` separa lembretes de documentos de
-- tarefas/anotações: 'reminder' = lembrete do mural (com disparo); 'doc' = tarefa/anotação
-- (editor de texto + checklist, SEM alarme). Docs reaproveitam TUDO do lembrete: mesmo
-- compartilhamento (note_shares), quadros, comentários, anexos, realtime e RLS.
-- A checklist do doc vive na coluna `style` (jsonb, já existia desde a 0001).
-- Rode no SQL Editor DEPOIS de 0001→0011.

alter table public.notes
  add column if not exists kind text not null default 'reminder'
  check (kind in ('reminder', 'doc'));

create index if not exists notes_kind_idx on public.notes (kind);
