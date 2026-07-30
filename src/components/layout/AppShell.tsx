import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { initialsFromName } from '@/lib/constants'
import { authService } from '@/services/authService'
import { hasSupabase } from '@/services/supabase'
import { Icon } from '@/components/ui/Icon'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Lembretes', icon: 'layout-grid' },
  { to: '/pessoas', label: 'Pessoas', icon: 'users' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

const TITLES: Record<string, string> = {
  '/': 'Meus lembretes',
  '/pessoas': 'Pessoas',
  '/ajustes': 'Ajustes',
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const openEditor = useAppStore((s) => s.openEditor)
  const openProfile = useAppStore((s) => s.openProfile)
  const profile = useAppStore((s) => s.profile)
  const logout = useAppStore((s) => s.logout)
  const query = useAppStore((s) => s.query)
  const setQuery = useAppStore((s) => s.setQuery)
  const { data: reminders } = useReminders()
  const myInitials = initialsFromName(profile.name)

  const activeCount = (reminders ?? []).filter((r) => r.status === 'active').length
  const isMural = pathname === '/'
  const title = TITLES[pathname] ?? 'SB Notas'

  const onLogout = async () => {
    if (hasSupabase) await authService.signOut() // a sessão real dispara setAuthed(false)
    else logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Sidebar — desktop */}
      <aside className="hidden w-[236px] flex-none flex-col border-r border-border bg-bg-surface px-3.5 py-[18px] md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-[18px] pt-1.5">
          <Brand size={30} />
          <span className="whitespace-nowrap text-base font-bold tracking-[-.01em]">SB Notas</span>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="mb-4 flex h-[42px] w-full items-center gap-2.5 rounded-md bg-accent px-3 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="plus" size={16} /> Novo lembrete
        </button>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm transition-colors ${
                isActive
                  ? 'bg-accent-surface font-semibold text-accent'
                  : 'font-medium text-text-secondary hover:bg-bg-elevated'
              }`
            }
          >
            <Icon name={n.icon} size={18} />
            <span className="flex-1 text-left">{n.label}</span>
            {n.to === '/' && activeCount > 0 && (
              <span className="text-xs font-semibold text-text-muted">{activeCount}</span>
            )}
          </NavLink>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1 border-t border-border py-2.5 pl-1 pr-2">
          <button
            onClick={openProfile}
            title="Meu perfil"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-elevated"
          >
            <span
              className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-xs font-bold text-[#0A0A0B]"
              style={{ background: profile.color }}
            >
              {myInitials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{profile.name}</div>
              <div className="text-xs text-text-muted">{profile.plan}</div>
            </div>
          </button>
          <button
            onClick={onLogout}
            title="Sair"
            className="grid h-8 w-8 flex-none place-items-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <Icon name="log-out" size={16} />
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-bg-base">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-3 border-b border-border px-4 backdrop-blur-md md:px-7"
          style={{ background: 'rgba(10,10,11,.7)' }}
        >
          <div className="flex items-center gap-2 font-bold md:hidden">
            <Brand size={26} />
            <span className="text-base">{title}</span>
          </div>
          <h2 className="m-0 hidden text-lg font-bold tracking-[-.01em] md:block">{title}</h2>
          <div className="flex-1" />
          {isMural && (
            <div className="flex h-10 w-40 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 transition-colors focus-within:border-border-strong md:w-[300px]">
              <Icon name="search" size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                id="mural-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar lembretes…"
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
              />
              {query ? (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                  title="Limpar busca"
                  className="grid h-5 w-5 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text-primary"
                >
                  <Icon name="x" size={14} />
                </button>
              ) : (
                <span className="kbd hidden flex-none md:inline-grid" aria-hidden>
                  /
                </span>
              )}
            </div>
          )}
          {/* Acesso ao perfil no mobile (no desktop fica no rodapé da sidebar). */}
          <button
            onClick={openProfile}
            title="Meu perfil"
            aria-label="Meu perfil"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-[13px] font-bold text-[#0A0A0B] md:hidden"
            style={{ background: profile.color }}
          >
            {myInitials}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-7 md:pb-10 md:pt-7">
          {children}
        </main>

        {/* Bottom nav — mobile */}
        <nav className="sticky bottom-0 z-[5] flex h-16 flex-none items-center justify-around border-t border-border bg-bg-surface md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex h-full flex-1 flex-col items-center justify-center gap-[3px] ${
                  isActive ? 'text-accent' : 'text-text-muted'
                }`
              }
            >
              <Icon name={n.icon} size={20} />
              <span className="text-[10px] font-semibold">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* FAB — mobile */}
        <button
          onClick={() => openEditor(null)}
          className="absolute grid h-14 w-14 place-items-center rounded-full bg-accent text-text-on-accent shadow-fab md:hidden"
          style={{ right: 18, bottom: 80, zIndex: 6 }}
          aria-label="Novo lembrete"
        >
          <Icon name="plus" size={26} />
        </button>
      </div>
    </div>
  )
}

function Brand({ size }: { size: number }) {
  return (
    <span
      className="grid place-items-center rounded-md bg-accent text-text-on-accent"
      style={{ width: size, height: size }}
    >
      <Icon name="bell" size={size * 0.55} />
    </span>
  )
}
