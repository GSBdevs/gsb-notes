import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useLiveTrigger } from '@/hooks/useLiveTrigger'
import { usePresence } from '@/hooks/usePresence'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/screens/AuthScreen'
// Telas de rota carregadas sob demanda (code splitting): cada uma vira um chunk próprio.
const MuralScreen = lazy(() => import('@/screens/MuralScreen').then((m) => ({ default: m.MuralScreen })))
const TasksScreen = lazy(() => import('@/screens/TasksScreen').then((m) => ({ default: m.TasksScreen })))
const PeopleScreen = lazy(() => import('@/screens/PeopleScreen').then((m) => ({ default: m.PeopleScreen })))
const SettingsScreen = lazy(() =>
  import('@/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const NotificationsScreen = lazy(() =>
  import('@/screens/NotificationsScreen').then((m) => ({ default: m.NotificationsScreen })),
)
const BlocosScreen = lazy(() => import('@/screens/BlocosScreen').then((m) => ({ default: m.BlocosScreen })))
import { ReminderEditor } from '@/components/editor/ReminderEditor'
import { TaskEditor } from '@/components/editor/TaskEditor'
import { BlockEditorSheet } from '@/components/editor/BlockEditorSheet'
import { ReminderViewSheet } from '@/components/ReminderViewSheet'
import { ThemeApplier } from '@/components/ThemeApplier'
import { TriggerOverlay } from '@/components/trigger/TriggerOverlay'
import { ReminderScheduler } from '@/components/ReminderScheduler'
import { AutoSnooze } from '@/components/AutoSnooze'
import { ProfileSheet } from '@/components/profile/ProfileSheet'
import { PasswordRecoverySheet } from '@/components/profile/PasswordRecoverySheet'
import { PersonSheet } from '@/components/people/PersonSheet'
import { UpdateBanner } from '@/components/UpdateBanner'
import { OfflineWatcher } from '@/components/OfflineWatcher'
import { NotificationToaster } from '@/components/NotificationToaster'
import { Toast } from '@/components/ui/Toast'

function Protected({ children }: { children: React.ReactNode }) {
  const authed = useAppStore((s) => s.authed)
  if (!authed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useKeyboardShortcuts()
  useAuthSession()
  useRealtimeSync()
  useLiveTrigger()
  usePresence()
  const authed = useAppStore((s) => s.authed)
  const openEditor = useAppStore((s) => s.openEditor)

  // Atalho do PWA "Novo lembrete" (?compose=new): abre o editor e limpa a URL.
  useEffect(() => {
    if (!authed) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('compose') === 'new') {
      openEditor(null)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [authed, openEditor])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthScreen />} />
        <Route
          path="/"
          element={
            <Protected>
              <AppShell>
                <MuralScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/tarefas"
          element={
            <Protected>
              <AppShell>
                <TasksScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/blocos"
          element={
            <Protected>
              <AppShell>
                <BlocosScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/pessoas"
          element={
            <Protected>
              <AppShell>
                <PeopleScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/ajustes"
          element={
            <Protected>
              <AppShell>
                <SettingsScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/notificacoes"
          element={
            <Protected>
              <AppShell>
                <NotificationsScreen />
              </AppShell>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Overlays globais */}
      <ThemeApplier />
      <ReminderEditor />
      <TaskEditor />
      <BlockEditorSheet />
      <ReminderViewSheet />
      <TriggerOverlay />
      <ProfileSheet />
      <PasswordRecoverySheet />
      <PersonSheet />
      {authed && <ReminderScheduler />}
      {authed && <AutoSnooze />}
      <UpdateBanner />
      {authed && <OfflineWatcher />}
      <Toast />
      <NotificationToaster />
    </BrowserRouter>
  )
}
