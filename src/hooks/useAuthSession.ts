import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/store/useAppStore'

/**
 * Liga a sessão do Supabase Auth ao estado do app (Fase 2). Sem Supabase (.env vazio),
 * não faz nada — o modo mock usa o login local do store.
 * - Hidrata `authed` a partir da sessão real (boot + mudanças).
 * - Carrega o perfil do banco (`profiles`) para o store.
 * - Ao trocar de usuário/logout, limpa o cache de dados.
 */
export function useAuthSession() {
  const setAuthed = useAppStore((s) => s.setAuthed)
  const setProfile = useAppStore((s) => s.setProfile)
  const setRecovering = useAppStore((s) => s.setRecovering)
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return
    let active = true

    const hydrateProfile = async (userId: string) => {
      const { data } = await supabase!
        .from('profiles')
        .select('display_name, avatar_color, avatar_url')
        .eq('id', userId)
        .maybeSingle()
      if (!active || !data) return
      setProfile({
        name: data.display_name ?? 'Usuário',
        color: data.avatar_color ?? '#FACC15',
        avatarUrl: data.avatar_url ?? null,
      })
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setAuthed(!!data.session)
      if (data.session) void hydrateProfile(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setAuthed(!!session)
      // Clique no link de recuperação → abre a tela de definir nova senha.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (session) void hydrateProfile(session.user.id)
      // Troca de conta/logout: descarta dados em cache do usuário anterior.
      qc.invalidateQueries()
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [setAuthed, setProfile, setRecovering, qc])
}
