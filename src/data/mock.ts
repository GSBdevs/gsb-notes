import type { Person, Reminder } from '@/types'

/** Seed de lembretes (portado do protótipo). Substituído por dados do Supabase na Fase 2. */
type SeedReminder = Omit<
  Reminder,
  | 'remindAt'
  | 'tags'
  | 'mine'
  | 'reads'
  | 'workspaceId'
  | 'ownerId'
  | 'ownerName'
  | 'ownerColor'
  | 'myShare'
  | 'kind'
  | 'checklist'
>

const RAW_REMINDERS: SeedReminder[] = [
  {
    id: '1',
    title: 'Reunião de equipe',
    body: 'Sprint review no Meet. Levar o resumo das métricas da semana.',
    color: '#60A5FA',
    priority: 'important',
    time: 'Hoje, 14:30',
    pinned: true,
    recurrence: 'weekly',
    status: 'active',
    shares: [
      { userId: 'mb', initials: 'MB', color: '#F472B6', name: 'Marina Braga', perm: 'edit' },
      { userId: 'jr', initials: 'JR', color: '#22C55E', name: 'João Reis', perm: 'view' },
    ],
  },
  {
    id: '2',
    title: 'Tomar remédio',
    body: '1 comprimido depois do almoço, com bastante água.',
    color: '#EF4444',
    priority: 'urgent',
    time: 'Hoje, 13:00',
    pinned: false,
    recurrence: 'daily',
    status: 'active',
    shares: [],
  },
  {
    id: '3',
    title: 'Ligar para o dentista',
    body: 'Remarcar limpeza para a próxima semana.',
    color: '#FACC15',
    priority: 'normal',
    time: 'Hoje, 16:00',
    pinned: false,
    recurrence: 'once',
    status: 'active',
    shares: [],
  },
  {
    id: '4',
    title: 'Pagar internet',
    body: 'Boleto vence hoje — evitar a multa de atraso.',
    color: '#F59E0B',
    priority: 'important',
    time: 'Hoje, 18:00',
    pinned: false,
    recurrence: 'monthly',
    status: 'active',
    shares: [],
  },
  {
    id: '5',
    title: 'Comprar presente da Ana',
    body: 'Aniversário no sábado. Ela comentou do livro novo.',
    color: '#A78BFA',
    priority: 'normal',
    time: 'Amanhã, 10:00',
    pinned: false,
    recurrence: 'once',
    status: 'active',
    shares: [{ userId: 'lt', initials: 'LT', color: '#60A5FA', name: 'Lucas T.', perm: 'view' }],
  },
  {
    id: '6',
    title: 'Regar as plantas',
    body: 'Só as da varanda — as de dentro foram ontem.',
    color: '#22C55E',
    priority: 'normal',
    time: 'Hoje, 19:30',
    pinned: false,
    recurrence: 'daily',
    status: 'active',
    shares: [],
  },
  {
    id: '7',
    title: 'Renovar assinatura',
    body: 'Plano anual da ferramenta de design.',
    color: '#94A3B8',
    priority: 'normal',
    time: '25 jul, 09:00',
    pinned: false,
    recurrence: 'once',
    status: 'scheduled',
    shares: [],
  },
  {
    id: '8',
    title: 'Consulta médica',
    body: 'Dr. Prado — levar exames anteriores.',
    color: '#60A5FA',
    priority: 'important',
    time: '28 jul, 11:15',
    pinned: false,
    recurrence: 'once',
    status: 'scheduled',
    shares: [],
  },
  {
    id: '9',
    title: 'Backup mensal',
    body: 'Rodar backup completo da máquina.',
    color: '#FACC15',
    priority: 'normal',
    time: '01 ago, 08:00',
    pinned: false,
    recurrence: 'monthly',
    status: 'scheduled',
    shares: [],
  },
  {
    id: '10',
    title: 'Entregar relatório',
    body: 'Enviado para a diretoria. Feito.',
    color: '#22C55E',
    priority: 'normal',
    time: '18 jul, 17:00',
    pinned: false,
    recurrence: 'once',
    status: 'archived',
    shares: [],
  },
  {
    id: '11',
    title: 'Confirmar voo',
    body: 'Check-in online concluído.',
    color: '#94A3B8',
    priority: 'normal',
    time: '15 jul, 12:00',
    pinned: false,
    recurrence: 'once',
    status: 'archived',
    shares: [],
  },
]

/** Seeds do mock não têm horário real; `remindAt` fica null (o mock é fallback). */
export const SEED_REMINDERS: Reminder[] = RAW_REMINDERS.map((r) => ({
  ...r,
  remindAt: null,
  tags: [],
  mine: true, // no mock, tudo é do usuário logado
  reads: [],
  workspaceId: null,
  ownerId: 'me',
  ownerName: 'Você',
  ownerColor: '#FACC15',
  myShare: null,
  kind: 'reminder' as const,
  checklist: [],
}))

export const SEED_PEOPLE: Person[] = [
  { userId: 'mb', initials: 'MB', color: '#F472B6', name: 'Marina Braga', perm: 'edit', online: true },
  { userId: 'jr', initials: 'JR', color: '#22C55E', name: 'João Reis', perm: 'view', online: true },
  { userId: 'lt', initials: 'LT', color: '#60A5FA', name: 'Lucas Teixeira', perm: 'view', online: false },
  { userId: 'cs', initials: 'CS', color: '#A78BFA', name: 'Camila Souza', perm: 'edit', online: false },
]
