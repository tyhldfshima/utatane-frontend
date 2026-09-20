import { describe, it, expect, vi } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { createRequire } from 'node:module'

// 旧組にしかない4機能の回帰試験（比較便 15d7d1be → 移行設計便 c8c927e7）。
//
// ★目的：新組（app/ui）へ機能を移すまでの間、旧組のこの4枚が
//   「消えていない・役目が変わっていない」ことを固定する。
//   移植の設計は docs/design/utatane-screen-consolidation.md にある。
//
// ★この試験は「いまの姿」を写し取った物です。移植が終わって旧の画面を消す段では、
//   この試験も一緒に消します（消す段は ★NPM_TOKEN と #4〜#6 の区切りの後）。
//
// ★本体のコードは1文字も変えていません（試験だけ）。
//
// 旧の画面はブラウザで動く部品なので、外の物（住所・ログインの状態・問い合わせ）は
// 差し替えて描きます。★外へは1回も通信しません。

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => '/',
}))

const FAKE_USER = { id: 'u-me', name: 'わたし' }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    login: async () => {},
    logout: () => {},
    isLoading: false,
    user: FAKE_USER,
    isAuthenticated: true,
  }),
}))
vi.mock('@/stores/playerStore', () => ({ usePlayerStore: () => ({ play: () => {}, current: null }) }))

// 問い合わせの答えは、画面ごとに差し替える（問い合わせの名前で分ける）
let queryData: Record<string, unknown> = {}
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey?: unknown[] }) => {
    const key = String(opts?.queryKey?.[0] ?? '')
    const data = queryData[key]
    return { data, isLoading: data === undefined, error: null, refetch: () => {} }
  },
  useMutation: () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: () => {} }),
}))
// ★外の住所は呼ばせない（呼ぼうとしたら、その場で分かるように投げる）
vi.mock('@/lib/api', () => {
  const stop = () => {
    throw new Error('この試験は外へ通信しません')
  }
  return {
    api: new Proxy({}, { get: () => stop }),
    ApiError: class ApiError extends Error {},
  }
})

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (mod: string, data: Record<string, unknown> = {}) => {
  queryData = data
  const Page = (await import(/* @vite-ignore */ mod)).default as () => ReactElement
  return renderToStaticMarkup(h(Page))
}

// ── ① ログイン（新組に無い・#4 が @tyhld/auth へ作り直す） ──────────

describe('① ログイン（/login）', () => {
  it('画面が在り、ログインとアカウント作成の両方を名乗る', async () => {
    const html = await render('@/app/login/page')
    expect(html).toContain('ウタタネ')
    expect(html).toContain('ログイン')
    // ★入り口の2つ（いまは同じ画面で切り替える形）
    expect(html).toContain('メールアドレス')
    expect(html).toContain('パスワード')
  })

  it('★合言葉の入力は、画面に出さない形になっている', async () => {
    const html = await render('@/app/login/page')
    expect(html).toContain('type="password"')
  })
})

// ── ② ウォレット（TYP の残高・贈る・換金・寄付・履歴） ───────────────

describe('② ウォレット（/wallet）', () => {
  const WALLET = { wallet: { convertible_balance: 1200, sendable_balance: 800 }, 'wallet-history': { history: [] } }

  it('画面が在り、2つの残高を分けて出す', async () => {
    const html = await render('@/app/wallet/page', WALLET)
    expect(html).toContain('TYPウォレット')
    // ★2残高（換金できる分と、贈るだけの分）を混ぜない
    expect(html).toContain('換金可能残高')
    expect(html).toContain('送付専用残高')
    expect(html).toContain('他者への感謝にのみ使えます')
  })

  it('取引履歴の見出しが在る', async () => {
    const html = await render('@/app/wallet/page', WALLET)
    expect(html).toContain('取引履歴')
  })

  it('★ログインしていないときは、残高を出さずにログインへ促す', async () => {
    vi.resetModules()
    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({ user: null, isAuthenticated: false, isLoading: false, login: async () => {} }),
    }))
    try {
      const Page = (await import('@/app/wallet/page')).default as () => ReactElement
      const html = renderToStaticMarkup(h(Page))
      expect(html).toContain('ウォレットを確認するにはログインが必要です')
      expect(html).not.toContain('換金可能残高')
    } finally {
      vi.doUnmock('@/stores/authStore')
      vi.resetModules()
    }
  })
})

// ── ③ お知らせ（通知の一覧・既読） ──────────────────────────────

describe('③ お知らせ（/notifications）', () => {
  it('画面が在り、「通知」と名乗る', async () => {
    const html = await render('@/app/notifications/page')
    expect(html).toContain('通知')
  })

  it('★絞り込みの札が在る（TYP と音楽を分けて見られる）', async () => {
    const html = await render('@/app/notifications/page')
    expect(html).toContain('TYP')
    expect(html).toContain('音楽')
  })
})

// ── ④ フィード（新着・人気で歌を見つける） ─────────────────────────

describe('④ フィード（/feed）', () => {
  it('画面が在り、看板の言葉を出す', async () => {
    const html = await render('@/app/feed/page')
    expect(html).toContain('一粒の歌が、')
    expect(html).toContain('森になる。')
  })

  it('★並び替えは「新着順」と「人気順」の2つ', async () => {
    const html = await render('@/app/feed/page')
    expect(html).toContain('新着順')
    expect(html).toContain('人気順')
  })
})

// ── ⑤ 4枚とも、まだ消えていない ────────────────────────────────

describe('⑤ 旧組の4枚は、まだ1枚も消えていない', () => {
  const PAGES: [string, string][] = [
    ['ログイン', '@/app/login/page'],
    ['ウォレット', '@/app/wallet/page'],
    ['お知らせ', '@/app/notifications/page'],
    ['フィード', '@/app/feed/page'],
  ]

  it('4枚とも読み込めて、画面の部品を返す', async () => {
    for (const [name, mod] of PAGES) {
      const m = (await import(/* @vite-ignore */ mod)) as { default?: unknown }
      expect(`${name}:${typeof m.default}`).toBe(`${name}:function`)
    }
  })
})
