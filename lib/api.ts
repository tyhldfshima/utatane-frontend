// lib/api.ts 窶・繧ｦ繧ｿ繧ｿ繝・API 繧ｯ繝ｩ繧､繧｢繝ｳ繝・
// 繝舌ャ繧ｯ繧ｨ繝ｳ繝・(utatane-backend) 縺ｮ蜈ｨ繧ｨ繝ｳ繝峨・繧､繝ｳ繝医↓蟇ｾ蠢・

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// 笏笏 繧ｨ繝ｩ繝ｼ蝙・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

// 笏笏 繝ｪ繧ｯ繧ｨ繧ｹ繝亥・騾壼・逅・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token') : null

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401) {
    const ok = await tryRefresh()
    if (ok) return req<T>(path, init)
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new ApiError(401, 'unauthorized')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown_error')
  return data as T
}

async function tryRefresh(): Promise<boolean> {
  const refresh = typeof window !== 'undefined'
    ? localStorage.getItem('refresh_token') : null
  if (!refresh) return false
  try {
    const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const { access_token } = await res.json()
    localStorage.setItem('access_token', access_token)
    return true
  } catch { return false }
}

const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) })
const put = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const patch = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = <T>(path: string) =>
  req<T>(path, { method: 'DELETE' })

// 笏笏 蝙句ｮ夂ｾｩ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

export type UserRole = 'viewer' | 'composer' | 'lyricist' | 'musician'
export type WorkType = 'melody' | 'lyrics'
export type ReuseMode = 'open' | 'exclusive'

export interface User {
  id: string; name: string; email: string
  bio: string | null; avatar_url: string | null
  roles: UserRole[]
  convertible_balance: number; sendable_balance: number
  wallet_address: string | null; scout_dm_enabled: boolean
  created_at: string
}

export interface PublicUser {
  id: string; name: string; bio: string | null; avatar_url: string | null
  roles: UserRole[]; scout_dm_enabled: boolean
  works_count: number; versions_count: number
  followers_count: number; following_count: number
  total_typ_earned: number; is_following: boolean
}

export interface Work {
  id: string; creator_id: string
  creator: { id: string; name: string; avatar_url: string | null }
  type: WorkType; title: string; file_url: string
  bpm: number | null; key: string | null
  reuse_mode: ReuseMode; origin_version_id: string | null
  collab_message: string | null
  versions_count: number; play_count: number
  total_typ: number | null; total_revenue: number | null
  created_at: string
}

export interface VersionStat {
  id: string; title: string
  audio_url: string | null; video_external_url: string | null
  play_count: number; typ_received: number; purchase_revenue: number | null
  partner_work: { id: string; title: string; type: WorkType; creator: { id: string; name: string } } | null
  musician: { id: string; name: string } | null
  created_at: string
}

export interface WorkDetail extends Work {
  versions: VersionStat[]
  total_plays: number; total_typ: number; total_revenue: number
}

export interface Contributor {
  user_id: string; name: string; role: string; share_pct: number
}

export interface Version {
  id: string; title: string
  audio_url: string | null; video_external_url: string | null; lyrics_text: string | null
  play_count: number; price: number
  melody_work: { id: string; title: string }
  lyrics_work:  { id: string; title: string }
  contributors: Contributor[]
  stats: { total_revenue_typ: number; purchase_count: number; tip_count: number }
  created_at: string
}

export interface Wallet { convertible_balance: number; sendable_balance: number }

export interface WalletHistoryItem {
  direction: 'received' | 'sent' | 'redeemed'
  amount: number; created_at: string
  counterpart_id: string | null; version_id: string | null; message: string | null
}

export interface Notification {
  id: string; type: string; read: boolean
  payload: Record<string, unknown>
  from_user: { id: string; name: string; avatar_url: string | null } | null
  created_at: string
}

export interface BankInfo {
  bank_name: string; branch_name: string
  account_type: 'ordinary' | 'current'
  account_number: string; account_name: string
}

export interface VersionContributorInput {
  user_id: string; role: 'composer' | 'lyricist' | 'musician'; share_pct: number
}

// 笏笏 API 繝｡繧ｽ繝・ラ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

export const api = {
  // 隱崎ｨｼ
  register: (name: string, email: string, password: string) =>
    post<{ access_token: string; refresh_token: string; user: User }>(
      '/api/v1/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    post<{ access_token: string; refresh_token: string; user: User }>(
      '/api/v1/auth/login', { email, password }),
  logout: () => post<{ ok: boolean }>('/api/v1/auth/logout'),

  // 繝ｦ繝ｼ繧ｶ繝ｼ
  getMe: () => req<User>('/api/v1/users/me'),
  updateMe: (data: { name?: string; bio?: string; scout_dm_enabled?: boolean }) =>
    put<User>('/api/v1/users/me', data),
  addRole: (role: 'composer' | 'lyricist' | 'musician') =>
    patch<{ id: string; name: string; roles: UserRole[] }>('/api/v1/users/me/roles', { role }),
  getUser: (id: string) => req<PublicUser>(`/api/v1/users/${id}`),
  getUserWorks: (id: string) => req<{ works: Work[] }>(`/api/v1/users/${id}/works`),
  getUserVersions: (id: string) => req<{ versions: Version[] }>(`/api/v1/users/${id}/versions`),
  follow: (id: string) => post<{ ok: boolean }>(`/api/v1/users/${id}/follow`),
  unfollow: (id: string) => del<{ ok: boolean }>(`/api/v1/users/${id}/follow`),

  // 菴懷刀
  getWorks: (p?: { type?: WorkType; reuse_mode?: ReuseMode; limit?: number; offset?: number }) => {
    const q = new URLSearchParams(p as Record<string, string>).toString()
    return req<{ works: Work[] }>(`/api/v1/works${q ? `?${q}` : ''}`)
  },
  createWork: (data: {
    type: WorkType; title: string; file_url: string
    bpm?: number; key?: string; reuse_mode?: ReuseMode
    origin_version_id?: string; collab_message?: string
  }) => post<Work>('/api/v1/works', data),
  getWork: (id: string) => req<WorkDetail>(`/api/v1/works/${id}`),
  setReuseMode: (id: string, reuse_mode: ReuseMode) =>
    patch<{ id: string; reuse_mode: ReuseMode }>(`/api/v1/works/${id}/reuse`, { reuse_mode }),

  // 繝舌・繧ｸ繝ｧ繝ｳ
  getVersions: (p?: { limit?: number; offset?: number; type?: string; sort?: string; page?: string }) => {
    const q = new URLSearchParams(p as Record<string, string>).toString()
    return req<{ versions: Version[] }>(`/api/v1/versions${q ? `?${q}` : ''}`)
  },
  createVersion: (data: {
    melody_work_id: string; lyrics_work_id: string; title: string
    audio_url?: string; video_external_url?: string; lyrics_text?: string
    price?: number; contributors: VersionContributorInput[]
  }) => post<Version>('/api/v1/versions', data),
  getVersion: (id: string, ref?: string) =>
    req<Version>(`/api/v1/versions/${id}${ref ? `?ref=${ref}` : ''}`),
  recordPlay: (versionId: string) =>
    post<{ ok: boolean }>(`/api/v1/versions/${versionId}/play`),

  // 繝医Λ繝ｳ繧ｶ繧ｯ繧ｷ繝ｧ繝ｳ
  purchase: (version_id: string, payment_method: 'stripe' | 'typ', ref?: string) =>
    post<{ ok: boolean }>('/api/v1/transactions/purchase', { version_id, payment_method, ref }),
  tip: (version_id: string, amount: number, message?: string) =>
    post<{ ok: boolean }>('/api/v1/transactions/tip', { version_id, amount, message }),

  // 繧ｦ繧ｩ繝ｬ繝・ヨ
  getWallet: () => req<Wallet>('/api/v1/wallet'),
  getWalletHistory: (p?: { limit?: number; offset?: number; action?: string }) => {
    const q = new URLSearchParams(p as Record<string, string>).toString()
    return req<{ history: WalletHistoryItem[] }>(`/api/v1/wallet/history${q ? `?${q}` : ''}`)
  },
  sendTYP: (to_user_id: string, amount: number, message?: string) =>
    post<{ ok: boolean }>('/api/v1/wallet/send', { to_user_id, amount, message }),
  redeemTYP: (amount: number, bank_info: BankInfo) =>
    post<{ ok: boolean; fee_amount: number; net_amount: number; scheduled_at: string }>(
      '/api/v1/wallet/redeem', { amount, bank_info }),
  donateTYP: (amount: number, cause?: string) =>
    post<{ ok: boolean }>('/api/v1/wallet/donate', { amount, cause }),

  // 騾夂衍
  getNotifications: (p?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams(p as Record<string, string>).toString()
    return req<{ notifications: Notification[]; unread_count: number }>(
      `/api/v1/notifications${q ? `?${q}` : ''}`)
  },
  readNotification: (id: string) =>
    post<{ ok: boolean }>(`/api/v1/notifications/${id}/read`),
  readAllNotifications: () =>
    post<{ ok: boolean }>('/api/v1/notifications/read-all'),
}

