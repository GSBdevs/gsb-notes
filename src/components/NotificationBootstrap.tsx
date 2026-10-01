import { useEffect } from 'react'
import { platform } from '@/platform'

/**
 * No app nativo (Capacitor/Android), pede a permissão de notificação LOGO NO INÍCIO — antes mesmo do
 * login. Sem `POST_NOTIFICATIONS` concedida (Android 13+), NADA dispara: nem alarme de lembrete, nem
 * a notificação persistente dos fixados. O `DesktopNotifier` também pede após o login (web/desktop),
 * mas no celular o pedido precisa vir na abertura — é o que o usuário espera ver.
 */
export function NotificationBootstrap() {
  useEffect(() => {
    // Diagnóstico: aparece no Logcat (tag "Capacitor/Console") e no console do WebView (chrome://inspect).
    if (platform.kind !== 'capacitor') return
    void platform.requestNotificationPermission().catch(() => {})
  }, [])
  return null
}
