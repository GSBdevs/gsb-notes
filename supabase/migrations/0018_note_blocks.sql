-- Blocos de anotação (Fase 5). Documentos em blocos estilo Notion (editor BlockNote), guardados
-- como jsonb em `notes.content`. Novo kind 'block' — reusa RLS, compartilhamento, comentários e
-- realtime das notas. Rode no SQL Editor DEPOIS de 0017.

alter table public.notes add column if not exists content jsonb;

-- Estende o CHECK de kind (era 'reminder'|'doc' na 0012) para aceitar 'block'.
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('reminder', 'doc', 'block'));
