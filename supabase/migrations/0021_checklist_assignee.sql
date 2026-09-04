-- Atribuir item de checklist a alguém (assignee — "quem DEVE") — backlog #7. Complementa o
-- `done_by` (0016, "quem CONCLUIU"). Editores atribuem; todos que veem a tarefa enxergam o
-- responsável. Não precisa RPC nem policy nova: setar `assignee` é um UPDATE do item, já coberto
-- pela policy note_checklist_items_update (can_edit_note) da 0016. Rode DEPOIS de 0016.

alter table public.note_checklist_items
  add column if not exists assignee uuid references public.profiles(id) on delete set null;

create index if not exists note_checklist_items_assignee_idx
  on public.note_checklist_items (assignee);
