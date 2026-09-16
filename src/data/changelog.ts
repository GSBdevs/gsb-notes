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
  {
    version: '0.5.0',
    date: '2026-09-04',
    title: 'Grande atualização',
    changes: [
      'Auto-snooze: um lembrete pode “insistir” — reaparece a cada X minutos até você concluir ou reagendar.',
      'Recorrência avançada: “a cada N dias/semanas/meses”, dias específicos da semana e “toda última sexta”.',
      'Visão “Hoje”: uma agenda do dia com seus lembretes em linha do tempo e um marcador de “Agora”.',
      'Tarefas: dá para atribuir um responsável a cada item do checklist (quem deve fazer).',
      'Recibos do disparo: dono e admins veem quem viu, concluiu ou adiou um lembrete.',
      'Excluir lembretes e tarefas direto pelo card ou pela tela, com confirmação.',
      'Quadros também nas abas Tarefas e Blocos, e cor da borda personalizável nos blocos.',
      'Notificações na área de trabalho e aviso quando alguém comenta numa nota.',
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
