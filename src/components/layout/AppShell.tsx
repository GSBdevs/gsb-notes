import { Suspense } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { useCreateBlock } from '@/hooks/useBlocks'
import { useOnline } from '@/hooks/useOnline'
import { initialsFromName } from '@/lib/constants'
import { authService } from '@/services/authService'
import { hasSupabase } from '@/services/supabase'
import { NotificationsBell } from '@/components/NotificationsBell'
import { Icon } from '@/components/ui/Icon'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Lembretes', icon: 'layout-grid' },
  { to: '/hoje', label: 'Hoje', icon: 'calendar-clock' },
  { to: '/tarefas', label: 'Tarefas', icon: 'list-todo' },
  { to: '/blocos', label: 'Blocos', icon: 'blocks' },
  { to: '/pessoas', label: 'Pessoas', icon: 'users' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

const TITLES: Record<string, string> = {
  '/': 'Meus lembretes',
  '/hoje': 'Hoje',
  '/tarefas': 'Tarefas',
  '/blocos': 'Blocos',
  '/pessoas': 'Pessoas',
  '/ajustes': 'Ajustes',
  '/notificacoes': 'Notificações',
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const openEditor = useAppStore((s) => s.openEditor)
  const openTask = useAppStore((s) => s.openTask)
  const createBlock = useCreateBlock()
  const openProfile = useAppStore((s) => s.openProfile)
  const profile = useAppStore((s) => s.profile)
  const logout = useAppStore((s) => s.logout)
  const query = useAppStore((s) => s.query)
  const setQuery = useAppStore((s) => s.setQuery)
  const { data: reminders } = useReminders()
  const online = useOnline()
  const myInitials = initialsFromName(profile.name)

  // Contagem de ativos por tipo, exibida na sidebar (Lembretes / Tarefas / Blocos).
  const all = reminders ?? []
  const countByRoute: Record<string, number> = {
    '/': all.filter((r) => r.kind === 'reminder' && r.status !== 'archived').length,
    '/tarefas': all.filter((r) => r.kind === 'doc' && r.status !== 'archived').length,
    '/blocos': all.filter((r) => r.kind === 'block' && r.status !== 'archived').length,
  }
  const isMural = pathname === '/'
  const isTasks = pathname === '/tarefas'
  const isBlocos = pathname === '/blocos'
  const title = TITLES[pathname] ?? 'SB Notas'
  // O botão de criar acompanha a tela: lembrete no mural, tarefa em /tarefas, bloco em /blocos.
  const createLabel = isBlocos ? 'Novo bloco' : isTasks ? 'Nova tarefa' : 'Novo lembrete'
  const createNew = () => (isBlocos ? createBlock.mutate() : isTasks ? openTask(null) : openEditor(null))

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
          onClick={createNew}
          className="mb-4 flex h-[42px] w-full items-center gap-2.5 rounded-md bg-accent px-3 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="plus" size={16} /> {createLabel}
        </button>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm transition-colors ${
                isActive
                  ? 'bg-accent-surface font-semibold text-accent-ink'
                  : 'font-medium text-text-secondary hover:bg-bg-elevated'
              }`
            }
          >
            <Icon name={n.icon} size={18} />
            <span className="flex-1 text-left">{n.label}</span>
            {countByRoute[n.to] > 0 && (
              <span className="text-xs font-semibold text-text-muted">{countByRoute[n.to]}</span>
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
              className="grid h-[30px] w-[30px] flex-none place-items-center overflow-hidden rounded-full text-xs font-bold text-[#0A0A0B]"
              style={{ background: profile.color }}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                myInitials
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{profile.name}</div>
              <div className="text-xs text-text-muted">Ver perfil</div>
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
      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip bg-bg-base">
        <header className="sticky top-0 z-[5] flex h-16 flex-none items-center gap-2 border-b border-border px-4 backdrop-blur-md md:gap-3 md:px-7"
          style={{ background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)' }}
        >
          <div className="flex min-w-0 items-center gap-2 font-bold md:hidden">
            <Brand size={26} />
            <span className="truncate text-base">{title}</span>
          </div>
          <h2 className="m-0 hidden text-lg font-bold tracking-[-.01em] md:block">{title}</h2>
          {!online && (
            <span
              title="Sem conexão — suas mudanças sincronizam ao voltar"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[12px] font-semibold text-text-secondary"
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: 'var(--text-muted)' }} />
              Offline
            </span>
          )}
          <div className="flex-1" />
          {isMural && (
            <div className="flex h-10 w-40 min-w-0 shrink items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 transition-colors focus-within:border-border-strong md:w-[300px] md:shrink-0">
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
          {/* Sino de notificações — desktop e mobile. */}
          <NotificationsBell />
          {/* Acesso ao perfil no mobile (no desktop fica no rodapé da sidebar). */}
          <button
            onClick={openProfile}
            title="Meu perfil"
            aria-label="Meu perfil"
            className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full text-[13px] font-bold text-[#0A0A0B] md:hidden"
            style={{ background: profile.color }}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              myInitials
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-7 md:pb-10 md:pt-7">
          {/* Coluna de conteúdo centralizada (layout A): capa a largura e centraliza em telas
              largas — o Mural preenche; Pessoas/Ajustes/Notificações centralizam sua coluna. */}
          <div className="mx-auto w-full max-w-[1160px]">
            <Suspense
              fallback={<p className="px-1 py-10 text-sm text-text-muted">Carregando…</p>}
            >
              {children}
            </Suspense>
          </div>
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
                  isActive ? 'text-accent-ink' : 'text-text-muted'
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
          onClick={createNew}
          className="absolute grid h-14 w-14 place-items-center rounded-full bg-accent text-text-on-accent shadow-fab md:hidden"
          style={{ right: 18, bottom: 80, zIndex: 6 }}
          aria-label={createLabel}
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
