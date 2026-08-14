-- Tags/etiquetas nas notas (Fase 3). Versão enxuta: rótulos de texto na própria nota
-- (array), sem tabela separada — a RLS de `notes` já protege. Rode no SQL Editor.
alter table public.notes add column if not exists tags text[] not null default '{}';

-- Índice GIN para filtrar por tag com eficiência (notes @> array['x']).
create index if not exists notes_tags_idx on public.notes using gin (tags);
