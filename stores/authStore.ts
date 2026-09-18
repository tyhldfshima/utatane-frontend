// stores/authStore.ts — ログインの状態（中央の TY アカウント・@tyhld/auth）
//
// ★自前の認証（メールとパスワード・localStorage のトークン）は外した（D-4）。
// セッションの保存と更新は @tyhld/auth（@supabase/ssr の Cookie）に任せ、ここでは持たない。
import { create } from 'zustand'
import { getSession, onAuthStateChange, signInWithGoogle, signOut } from '@tyhld/auth'

export interface AuthUser {
  /** TY アカウント id */
  id: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  /** 画面の最初に1回：今のセッションを読み、変化を購読する */
  init: () => () => void
  signIn: (next?: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,

  init: () => {
    getSession()
      .then((s) => set({ user: s ? { id: s.user.ty_account_id, email: s.user.email } : null, isLoading: false }))
      .catch(() => set({ user: null, isLoading: false }))
    try {
      const sub = onAuthStateChange((_event, s) =>
        set({ user: s ? { id: s.user.ty_account_id, email: s.user.email } : null, isLoading: false }),
      )
      return () => sub.unsubscribe()
    } catch {
      // 中央ログインの設定が無い（NEXT_PUBLIC_TY_AUTH_URL 等が未設定）＝ログインしていない状態で表示する
      set({ user: null, isLoading: false })
      return () => {}
    }
  },

  signIn: async (next = '/') => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    await signInWithGoogle({ redirectTo })
  },

  logout: async () => {
    await signOut()
    set({ user: null })
  },
}))

/** API を呼ぶときの Bearer（保存はしない。毎回 @tyhld/auth から読む） */
export async function currentAccessToken(): Promise<string | null> {
  try {
    const s = await getSession()
    return s ? s.access_token : null
  } catch {
    return null
  }
}
