// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, User, UserRole } from '@/lib/api'

interface AuthState {
  user:      User | null
  isLoading: boolean
  login:    (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout:   () => Promise<void>
  fetchMe:  () => Promise<void>
  addRole:  (role: 'composer' | 'lyricist' | 'musician') => Promise<void>
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:      null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { access_token, refresh_token, user } = await api.login(email, password)
          saveTokens(access_token, refresh_token)
          set({ user, isLoading: false })
        } catch (e) { set({ isLoading: false }); throw e }
      },

      register: async (name, email, password) => {
        set({ isLoading: true })
        try {
          const { access_token, refresh_token, user } = await api.register(name, email, password)
          saveTokens(access_token, refresh_token)
          set({ user, isLoading: false })
        } catch (e) { set({ isLoading: false }); throw e }
      },

      logout: async () => {
        try { await api.logout() } catch {}
        clearTokens()
        set({ user: null })
      },

      fetchMe: async () => {
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('access_token') : null
        if (!token) return
        try { set({ user: await api.getMe() }) }
        catch { set({ user: null }) }
      },

      addRole: async (role) => {
        const result = await api.addRole(role)
        const current = get().user
        if (current) {
          set({ user: { ...current, roles: result.roles as UserRole[] } })
        }
      },
    }),
    { name: 'utatane-auth', partialize: (s) => ({ user: s.user }) }
  )
)
