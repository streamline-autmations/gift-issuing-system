import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserProfile = {
  id: string
  role: string | null
  company_id: string | null
  email?: string
}

type AuthContextValue = {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  setProfile: (profile: UserProfile | null) => void
  signOut: () => Promise<void>
  isElevated: boolean
  toggleElevation: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isElevated, setIsElevated] = useState(() => {
    return localStorage.getItem('isElevated') === 'true'
  })

  const toggleElevation = () => {
    setIsElevated((prev) => {
      const next = !prev
      localStorage.setItem('isElevated', String(next))
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Using Ctrl + Alt + Shift + A to avoid ANY system/browser/extension conflicts
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        if (session?.user?.email === 'admin@africannomad.co.za') {
          e.preventDefault()
          toggleElevation()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [session?.user?.email, toggleElevation])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session ?? null)
      setLoading(false)
    }

    load()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile(userId: string, email?: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        setProfile({ id: userId, role: null, company_id: null, email })
        return
      }

      setProfile({
        id: data.id,
        role: data.role ?? null,
        company_id: data.company_id ?? null,
        email,
      })
    }

    if (!session?.user?.id) {
      setProfile(null)
      return
    }

    loadProfile(session.user.id, session.user.email)

    return () => {
      cancelled = true
    }
  }, [session?.user?.id, session?.user?.email])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      setProfile,
      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },
      isElevated,
      toggleElevation,
    }),
    [session, profile, loading, isElevated],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
