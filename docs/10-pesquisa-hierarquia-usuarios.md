# 10 — Pesquisa: hierarquia de usuários

Objetivo: avaliar como o SB Notas pode representar uma **hierarquia de usuários** — papéis e
permissões entre pessoas. Consultado em ago/2026. Fontes ao final.

> ⚠️ **"Hierarquia de usuários" tem duas leituras muito diferentes.** Antes de implementar, precisamos
> travar qual você quer (ou os dois). Este doc mapeia as duas e recomenda por onde começar.

## Como está hoje

O SB Notas **não tem papéis** globais. O acesso é combinado de três mecanismos pontuais:
- **Share 1:1 por nota** — permissão `view` / `edit` (`note_shares`).
- **Quadros (workspaces)** — `owner` + `members` **planos** (todo membro vê e cria; só o dono
  gerencia). Sem níveis intermediários.
- **Contatos** — relação bidirecional, sem permissão associada.

Não existe "admin", "gerente", nem uma árvore de quem-manda-em-quem.

## Leitura A — Papéis (RBAC) dentro dos quadros

"Hierarquia" = **níveis de permissão** num quadro/organização. É o padrão RBAC: permissões vão para
**papéis**, papéis vão para **usuários**; e o **escopo** importa (a mesma pessoa pode ter papéis
diferentes em quadros diferentes). Regras de ouro da pesquisa:
- **Menor privilégio**: cada papel só o mínimo necessário.
- **Escopo > multiplicar papéis**: "o que pode fazer" separado de "onde pode fazer" — mantém poucos
  papéis mesmo com acesso complexo.
- **Especificidade vence**: uma permissão por-nota (mais específica) prevalece sobre a do quadro.

**Proposta concreta (encaixa no que já existe):** um `role` em `workspace_members`:

| Papel | Pode |
|---|---|
| **owner** | tudo: renomear/excluir o quadro, gerir membros e papéis |
| **admin** | adicionar/remover membros, gerir notas do quadro |
| **member** | criar e editar notas do quadro |
| **viewer** | só ver |

- Migração: `alter table workspace_members add column role text default 'member'` + helpers RLS
  (`is_workspace_admin(wid)` ao lado do `is_workspace_member`/`owns_workspace` que já temos).
- A RLS de `notes` ganha a cláusula de papel (viewer não edita; admin gere).
- **Escopo por quadro** — nada de papel global, seguindo a boa prática.
- Esforço: **médio-baixo** (o modelo de quadros já existe; é estender `workspace_members` + RLS).

## Leitura B — Árvore organizacional (quem-manda-em-quem)

"Hierarquia" = **estrutura de reporte**: gerentes acima de subordinados (organograma). Ex.: um chefe
vê/atribui lembretes da equipe; níveis de time. Isso é um modelo **novo**, não é RBAC de quadro:
- Tabela de **organização/equipe** + `profiles.manager_id` (auto-referência) ou uma tabela
  `team_members(team_id, user_id, role)`.
- Permissões derivadas da árvore: "vejo o que está abaixo de mim".
- Bem mais invasivo (novo eixo de dados + RLS recursiva por subordinação).
- Esforço: **alto**.

## Recomendação

1. **Confirme a intenção.** Se é "níveis de permissão em quadros/grupos" → **Leitura A**. Se é
   "organograma / chefes e equipes" → **Leitura B**.
2. **Comece pela A** de qualquer forma — ela é a fundação (papéis com escopo) e cobre 80% dos casos
   com baixo custo, reusando os quadros. A B pode ser construída **por cima** depois (uma "equipe" é
   um quadro com papéis + relação de reporte), sem retrabalho.
3. Manter **poucos papéis** (owner/admin/member/viewer) e resolver variações por **escopo**
   (quadro vs. nota), não criando papéis novos.

## Esboço de escopo (Leitura A)

1. Migração `0019`: `workspace_members.role` (`owner|admin|member|viewer`) + backfill (dono→owner,
   demais→member) + helper `is_workspace_admin`.
2. RLS de `notes`/`workspace_members` considerando papel (viewer read-only; admin gere membros).
3. UI: seletor de papel na gestão de membros do quadro; badges de papel.
4. Serviço/hooks: `setMemberRole(workspaceId, userId, role)`.

## Fontes (ago/2026)

- BetterCloud — Fundamentals of RBAC: https://www.bettercloud.com/monitor/the-fundamentals-of-role-based-access-control/
- Baserow — Understanding role hierarchy for access control: https://baserow.io/user-docs/role-based-access-control-rbac
- LoginRadius — Access Control Design for Scalable RBAC: https://www.loginradius.com/blog/identity/design-effective-rbac-system
- Medium (Towards Data Engineering) — Shared Workspaces RBAC Model: https://medium.com/towards-data-engineering/implementing-the-shared-workspaces-rbac-model-4b92aa0e0230
- Oso — Real-World RBAC Examples: https://www.osohq.com/learn/rbac-examples
- NocoBase — How to Design an RBAC System: https://www.nocobase.com/en/blog/how-to-design-rbac-role-based-access-control-system
- Tech Prescient — RBAC Best Practices 2026: https://www.techprescient.com/blogs/role-based-access-control-best-practices/
