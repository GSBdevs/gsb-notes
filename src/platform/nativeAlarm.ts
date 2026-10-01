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
}

export interface AlarmPlugin {
  /** Agenda o alarme para `at` (epoch ms). `id` = inteiro estável do lembrete. */
  schedule(options: { id: number; at: number; title: string; body: string }): Promise<void>
  /** Cancela o alarme agendado (lembrete concluído/excluído/reagendado). */
  cancel(options: { id: number }): Promise<void>
  /** DIAGNÓSTICO: dispara o alarme agora pelo mesmo caminho de produção (broadcast → Receiver). */
  fireNow(options?: { id?: number; title?: string; body?: string }): Promise<void>
  /** DIAGNÓSTICO: estado do dispositivo (SDK, permissões, fabricante). */
  getInfo(): Promise<AlarmInfo>
  /** DIAGNÓSTICO: abre a tela do sistema p/ conceder "notificação em tela cheia" (Android 14+). */
  openFullScreenSettings(): Promise<void>
}

export const Alarm = registerPlugin<AlarmPlugin>('Alarm')
