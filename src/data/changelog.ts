/**
 * NOVIDADES / CHANGELOG — conteúdo do modal "Novidades" que aparece após uma atualização.
 *
 * ┌─ COMO USAR (você, dono) ──────────────────────────────────────────────────────────────┐
 * │ A cada release, ADICIONE um novo objeto NO TOPO da lista `CHANGELOG` (mais recente      │
 * │ primeiro). O `version` do primeiro item é a "versão atual": quando ele mudar, todo      │
 * │ usuário que ainda não viu esse número recebe o modal ao abrir o app (após instalar a    │
 * │ atualização). Escreva os itens em `changes` em linguagem simples — é o que aparece.     │
 * │                                                                                          │
 * │ Dica: mantenha o `version` igual ao do package.json / tauri.conf.json a cada release.   │
 * └──────────────────────────────────────────────────────────────────────────────────────┘
 */

export interface Release {
  /** Número da versão, ex.: '0.5.0'. O 1º item da lista é a versão atual. */
  version: string
  /** Data no formato 'AAAA-MM-DD' (mostrada por extenso no modal). */
  date: string
  /** Título opcional da atualização (ex.: 'Grande atualização'). */
  title?: string
  /** Lista de mudanças, em linguagem simples — cada item vira um marcador no modal. */
  changes: string[]
}

/** Releases, do mais recente para o mais antigo. EDITE AQUI a cada atualização. */
export const CHANGELOG: Release[] = [

  // TODO (dono): defina `version` (igual ao package.json/tauri.conf.json) e confira a data antes de lançar.

  {
    version: '1.3.5',
    date: '2026-10-08',
    title: 'Update no Android',
    changes: [
      'Teste de atualização automática no Android',
    ],
  },

  {
    version: '1.3.3',
    date: '2026-10-05',
    title: 'Hotfix - Tarefas',
    changes: [
      'Hotfix nas opções das tarefas',
    ],
  },

  {
    version: '1.3.2',
    date: '2026-10-05',
    title: 'Hotfix - Pastas e tarefas',
    changes: [
      'Hotfix nas notificações das pastas',
      'Fix e alteração do funcionamentos das opções das tarefas',  
    ],
  },

  {
    version: '1.3.1',
    date: '2026-10-05',
    title: 'Otimizações no Android',
    changes: [
      'Alteração no funcionamento dos quadros',
      'Hotfix no compartilhamento de lembretes',
      'Leve otimização no Android'     
    ],
  },

  {
    version: '1.3.0',
    date: '2026-10-01',
    title: 'Otimizações no Android',
    changes: [
      'Correção das notificações',
      'Tela de alarme dedicada',
      'Otimiazação de layout no Android',
      'Pequenas otimizações no Windows'      
    ],
  },

  {
    version: '1.2.0',
    date: '2026-09-29',
    title: 'Melhorias nas notificações e correções de bugs',
    changes: [
      'Fix da DM não notificando',
      'Fix nos apps não atualizando sozinhos',
      'Reforço nas notificações',
      'Novos plugins de notificação no Android'
      
    ],
  },

  {
    version: '1.1.1',
    date: '2026-09-25',
    title: 'Hotfix: correção de bugs e melhorias de desempenho',
    changes: [
      'Correção na barra lateral fixa',
      'Som nas notificações do app',
      'Lembretes e tarefas concluidas sao removidas automaticamente a cada 30 dias',
    ],
  },

  {
    version: '1.1.0',
    date: '2026-09-25',
    title: 'Mensagens, quadro Geral e mais organização',
    changes: [
      'Arraste para organizar: reordene seus lembretes, tarefas e blocos do jeito que quiser — e também os quadros.',
      'A barra lateral agora fica fixa: você chega ao perfil e aos atalhos sem precisar rolar a página inteira.',
      'O quadro Pessoal mostra só o que é seu; no Geral, os itens compartilhados aparecem primeiro.',
      'Android: o app passa a ocupar a tela inteira, sem conflito com a barra de status/notificações.',
      'Reforços de segurança e proteção dos seus dados.',

    ],
  },

  {
    version: '1.0.3',
    date: '2026-09-23',
    title: 'Mensagens, quadro Geral e listas',
    changes: [
      'Mensagens diretas: converse 1 a 1 com quem está nos seus contatos e quadros. Dá para responder mensagens e enviar lembretes, tarefas e blocos como cartão.',
      'Ao compartilhar uma nota com alguém, a pessoa recebe automaticamente uma mensagem avisando que foi adicionada.',
      'Quadro “Geral”: uma visão que reúne, só para consulta, tudo de todos os quadros — lembretes, tarefas e blocos — organizados por quadro, cada um com sua cor.',
      'Lembretes com lista de assuntos: comece a linha com “*” ou “-” e, na hora que o lembrete tocar, os itens aparecem organizados em lista.',
    ],
  },

  {
    version: '1.0.2',
    date: '2026-09-22',
    title: 'Melhorias e correções',
    changes: [
      'Otimizações no android',
      'Correção dos menus fechando ao clicar fora',
    ],
  },
  
  {
    version: '1.0.1',
    date: '2026-09-16',
    title: 'Grande atualização',
    changes: [
      'Auto-snooze: um lembrete pode “insistir” — reaparece a cada X minutos até você concluir ou reagendar.',
      'Recorrência avançada: “a cada N dias/semanas/meses”, dias específicos da semana e “toda última sexta”.',
      'Tarefas: dá para atribuir um responsável a cada item do checklist (quem deve fazer).',
      'Excluir lembretes e tarefas direto pelo card ou pela tela, com confirmação.',
      'Quadros também nas abas Tarefas e Blocos, e cor da borda personalizável nos blocos.',
      'Notificações na área de trabalho e aviso quando alguém comenta numa nota.',
      'As notificações do app agora aparecem no Windows (canto da tela) mesmo com ele minimizado na bandeja — como quando alguém comenta numa tarefa.',
      'Android: lembretes e tarefas fixados ficam parados na barra de notificações, sempre à vista.',
      'Android: ícone do app, layout mais responsivo e alarme mesmo com o app fechado.',
    ],
  },
]

/** Versão atual anunciada (o 1º item da lista). */
export const CURRENT_VERSION = CHANGELOG[0]?.version ?? '0.0.0'

/** Compara versões “x.y.z”: 1 se a>b, -1 se a<b, 0 se iguais. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/**
 * Releases ainda não vistos por quem tem `lastSeen` (null = primeira vez → só o mais recente).
 * Vazio = nada a anunciar.
 */
export function unseenReleases(lastSeen: string | null): Release[] {
  if (!lastSeen) return CHANGELOG.slice(0, 1)
  return CHANGELOG.filter((r) => compareVersions(r.version, lastSeen) > 0)
}
