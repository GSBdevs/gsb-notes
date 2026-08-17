/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

// Service worker próprio (vite-plugin-pwa, strategies: injectManifest). Mantém o precache do
// app shell (Workbox) e adiciona o handler de Web Push — a peça que faz o lembrete chegar com
// o app 100% fechado. O envio vem da Edge Function `dispatch-reminders-push`.

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)

// registerType: 'autoUpdate' → assume o controle assim que a nova versão ativa.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface FirePayload {
  reminderId?: string
  title?: string
  body?: string
}

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let data: FirePayload = {}
      try {
        data = (event.data?.json() as FirePayload) ?? {}
      } catch {
        data = {}
      }

      // App aberto e visível: o próprio app dispara o overlay chamativo (agendador local) —
      // não duplicamos com uma notificação do SO. Só notifica quando não há janela visível.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((c) => c.visibilityState === 'visible')) return

      await self.registration.showNotification(data.title || 'Lembrete', {
        body: data.body || 'Você tem um lembrete agora.',
        tag: data.reminderId || 'sb-notas',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        requireInteraction: true,
        data: { reminderId: data.reminderId },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((c) => 'focus' in c) as WindowClient | undefined
      if (existing) {
        await existing.focus()
      } else {
        await self.clients.openWindow('/')
      }
    })(),
  )
})
