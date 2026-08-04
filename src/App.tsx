import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/screens/AuthScreen'
import { MuralScreen } from '@/screens/MuralScreen'
import { PeopleScreen } from '@/screens/PeopleScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ReminderEditor } from '@/components/editor/ReminderEditor'
import { TriggerOverlay } from '@/components/trigger/TriggerOverlay'
import { ProfileSheet } from '@/components/profile/ProfileSheet'
import { PersonSheet } from '@/components/people/PersonSheet'
import { Toast } from '@/components/ui/Toast'
import { Icon } from '@/components/ui/Icon'

function Protected({ children }: { children: React.ReactNode }) {
  const authed = useAppStore((s) => s.authed)
  if (!authed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useKeyboardShortcuts()
  useAuthSession()
  useRealtimeSync()
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Overlays globais */}
      <ReminderEditor />
      <TriggerOverlay />
      <ProfileSheet />
      <PersonSheet />
      <Toast />
      <DevSimulate />
    </BrowserRouter>
  )
}

/** Botão de teste do disparo — apenas em desenvolvimento (some no build de produção). */
function DevSimulate() {
  const authed = useAppStore((s) => s.authed)
  const openTrigger = useAppStore((s) => s.openTrigger)
  if (!import.meta.env.DEV || !authed) return null
  return (
    <button
      onClick={() => openTrigger(null)}
      className="fixed bottom-7 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-strong bg-bg-elevated-2/95 px-3.5 py-2 text-[13px] font-semibold text-accent backdrop-blur-md"
      title="Somente em desenvolvimento"
    >
      <Icon name="zap" size={14} /> Simular disparo
    </button>
  )
}
