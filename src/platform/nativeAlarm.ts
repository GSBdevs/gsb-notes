import { registerPlugin } from '@capacitor/core'

/**
 * Ponte para o plugin nativo de ALARME (Android). Diferente de uma notificação comum, ele dispara
 * como o alarme do relógio: abre uma tela cheia por cima de tudo (mesmo com a tela bloqueada), toca
 * um som contínuo e vibra até o usuário concluir/adiar. Implementação nativa em
 * `android/app/src/main/java/com/gsbdevs/sbnotas/AlarmPlugin.java`.
 */

/** Estado do dispositivo p/ diagnóstico (ver AlarmPlugin.getInfo). */
export interface AlarmInfo {
  sdkInt: number
  manufacturer: string
  model: string
  /** Android 14+: se `false`, a tela cheia do alarme NÃO abre (vira só heads-up). */
  canUseFullScreenIntent: boolean
  /** Notificações do app habilitadas no SO (canal/permissão). */
  notificationsEnabled: boolean
  /** Android 12+: se pode agendar alarme exato (setAlarmClock é isento, mas informa mesmo assim). */
  canScheduleExactAlarms: boolean
  /** "Aparecer sobre outros apps" (overlay): com `true`, a tela do alarme abre sozinha mesmo com a
   * tela ligada/desbloqueada; com `false`, o disparo vira só heads-up (exige tocar na notificação). */
  canDrawOverlays: boolean
  /** App isento da otimização de bateria (Doze). `false` = o alarme pode atrasar. */
  isIgnoringBatteryOptimizations: boolean
}

export interface AlarmPlugin {
  /**
   * Agenda o alarme para `at` (epoch ms). `id` = inteiro estável do lembrete. `color` (hex do
   * lembrete), `priority` e `snoozeMin` alimentam a tela cheia (card + botão Adiar).
   */
  schedule(options: {
    id: number
    /** UUID do lembrete — usado no deep link do Concluir/Adiar (reflete no servidor). */
    noteId?: string
    at: number
    title: string
    body: string
    color?: string
    priority?: string
    snoozeMin?: number
    /** URI do som do alarme (toque escolhido no seletor). Vazio = som de alarme padrão. */
    soundUri?: string
    /** Cor de destaque do app (tema do usuário, hex). Colore cabeçalho/ações da tela cheia.
     * Vazio = âmbar padrão. Diferente de `color` (cor do lembrete, usada só na borda do card). */
    accent?: string
  }): Promise<void>
  /** Cancela o alarme agendado (lembrete concluído/excluído/reagendado). */
  cancel(options: { id: number }): Promise<void>
  /** Abre o seletor de toques do sistema (TYPE_ALARM). `cancelled` quando o usuário fecha sem escolher. */
  pickSound(options?: {
    currentUri?: string
  }): Promise<{ uri: string | null; name: string; cancelled?: boolean }>
  /** DIAGNÓSTICO: dispara o alarme agora pelo mesmo caminho de produção (broadcast → Receiver). */
  fireNow(options?: { id?: number; title?: string; body?: string }): Promise<void>
  /** DIAGNÓSTICO: estado do dispositivo (SDK, permissões, fabricante). */
  getInfo(): Promise<AlarmInfo>
  /** DIAGNÓSTICO: abre a tela do sistema p/ conceder "notificação em tela cheia" (Android 14+). */
  openFullScreenSettings(): Promise<void>
  /** DIAGNÓSTICO: abre a tela do sistema p/ conceder "Aparecer sobre outros apps" (overlay) —
   * faz o alarme abrir sozinho com a tela ligada, sem depender do toque na notificação. */
  openOverlaySettings(): Promise<void>
  /** Abre a tela do sistema p/ tirar o app da otimização de bateria (evita o alarme atrasar). */
  openBatterySettings(): Promise<void>
}

export const Alarm = registerPlugin<AlarmPlugin>('Alarm')
