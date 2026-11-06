import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { platform } from '@/platform'
import { useAppStore } from '@/store/useAppStore'
import { saveNativePushToken } from '@/services/pushService'

/**
 * Registro de push NATIVO (Android/Capacitor via FCM). Ao logar, pede permissão, registra no FCM e
 * salva o token no Supabase (via serviço) — é o que permite a `send-push` (Edge Function) entregar
 * notificações de app com o app FECHADO. O toque na notificação roteia para a tela certa.
 *
 * Só age no app nativo; web/desktop = no-op (lá o push é Web Push VAPID / bandeja do Tauri).
 * NÃO mostra nada em 1º plano: o toast in-app (via Realtime) já cobre o app aberto — evita duplicar.
 */
export function PushRegistrar() {
  const authed = useAppStore((s) => s.authed)
  const navigate = useNavigate()

  useEffect(() => {
    if (!authed || platform.kind !== 'capacitor') return
    let disposed = false
    const handles: Array<{ remove: () => void }> = []

    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') {
          console.warn('[SBNotas] push nativo: permissão negada ->', perm.receive)
          return
        }
        await PushNotifications.register()

        handles.push(
          await PushNotifications.addListener('registration', (t) => {
            void saveNativePushToken(t.value).catch((e) =>
              console.warn('[SBNotas] salvar token FCM falhou:', e),
            )
          }),
        )
        handles.push(
          await PushNotifications.addListener('registrationError', (e) => {
            console.warn('[SBNotas] FCM registrationError:', JSON.stringify(e))
          }),
        )
        // Toque na notificação (app em 2º plano/fechado): roteia p/ a tela relevante.
        handles.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = (action.notification?.data ?? {}) as Record<string, string>
            if (data.type === 'dm') navigate('/mensagens')
            else navigate('/notificacoes')
          }),
        )

        if (disposed) handles.forEach((h) => h.remove())
      } catch (e) {
        console.warn('[SBNotas] PushRegistrar erro:', e)
      }
    })()

    return () => {
      disposed = true
      handles.forEach((h) => {
        try {
          h.remove()
        } catch {
          /* ignora */
        }
      })
    }
  }, [authed, navigate])

  return null
}
