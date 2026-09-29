import { registerPlugin } from '@capacitor/core'

/**
 * Ponte para o plugin nativo de ALARME (Android). Diferente de uma notificação comum, ele dispara
 * como o alarme do relógio: abre uma tela cheia por cima de tudo (mesmo com a tela bloqueada), toca
 * um som contínuo e vibra até o usuário concluir/adiar. Implementação nativa em
 * `android/app/src/main/java/com/gsbdevs/sbnotas/AlarmPlugin.java`.
 */
export interface AlarmPlugin {
  /** Agenda o alarme para `at` (epoch ms). `id` = inteiro estável do lembrete. */
  schedule(options: { id: number; at: number; title: string; body: string }): Promise<void>
  /** Cancela o alarme agendado (lembrete concluído/excluído/reagendado). */
  cancel(options: { id: number }): Promise<void>
}

export const Alarm = registerPlugin<AlarmPlugin>('Alarm')
