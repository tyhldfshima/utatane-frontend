import { describe, it, expect, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { ReactElement } from 'react'
import SongLoading from './songs/[id]/loading'
import SongError from './songs/[id]/error'
import ThanksLoading from './songs/[id]/thanks/loading'
import ThanksError from './songs/[id]/thanks/error'
import ConsentLoading from './inbox/consent/[id]/loading'
import MeLoading from './me/loading'
import MeError from './me/error'
import JoinPage from './songs/[id]/join/page'
import ConsentPage from './inbox/consent/[id]/page'
import ThanksPage from './songs/[id]/thanks/page'
import SongPage from './songs/[id]/page'
import MePage from './me/page'
import { COPY } from '@/components/ui'
import { sampleSource, setUiDataSource, type UiDataSource } from '@/lib/ui-data'

// A・B・C・F・I の「読み込み中」と「うまくいきませんでした」（11状態）。
// ★文言は設計書 docs/design/utatane-focus-screens-spec.md §3 のとおり。設計書に無い文言は作らない。
// ★外の物は呼ばない。読み口を「遅い読み口」「落ちる読み口」に差し替えて確かめる。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const noop = () => {}
const boom = { error: new Error('落ちる読み口'), reset: noop }

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

/** 落ちる読み口：どの読み込みも失敗する（画面は投げ、Next の error が受け取る）。 */
function failingSource(): UiDataSource {
  const fail = async () => {
    throw new Error('通信に失敗しました')
  }
  return new Proxy({ isSample: false } as UiDataSource, {
    get(target, prop) {
      if (prop === 'isSample') return false
      return fail
    },
  })
}

/** 遅い読み口：答えが返らない（画面は待ち続け、Next の loading が出る）。 */
function slowSource(): UiDataSource {
  const never = () => new Promise<never>(() => {})
  return new Proxy({ isSample: false } as UiDataSource, {
    get(target, prop) {
      if (prop === 'isSample') return false
      return never
    },
  })
}

/** 「まだ答えが返っていない」＝読み込み中の枠が出る状態、を確かめる。 */
async function isStillPending(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending')
  const raced = await Promise.race([promise.then(() => 'done'), Promise.resolve(marker)])
  return raced === marker
}

describe('A 歌の画面：読み込み中とエラー', () => {
  it('読み込み中は、題名の枠と［再生］を先に出す（新しい文言を足さない）', async () => {
    const html = await render(SongLoading)
    expect(html).toContain('data-screen="song-loading"')
    expect(html).toContain('再生')
    expect(html).toContain('data-state="loading"')
    expect(html).toContain(COPY.loading)
  })

  it('エラーは「歌を読み込めませんでした」と通信の文言と［もう一度］', async () => {
    const html = await render(SongError, boom)
    expect(html).toContain('歌を読み込めませんでした')
    expect(html).toContain('通信がつながりませんでした。電波のよい所で、もう一度お試しください。')
    expect(html).toContain(COPY.retry)
    expect(html).toContain('data-state="error"')
    // 主ボタンは置かない
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('落ちる読み口だと、歌の画面は投げる（エラーの枠が受け取る）', async () => {
    restore = setUiDataSource(failingSource())
    await expect(SongPage({ params: { id: 'minato' } })).rejects.toThrow()
  })

  it('遅い読み口だと、歌の画面はまだ答えを返さない（読み込み中の枠が出る）', async () => {
    restore = setUiDataSource(slowSource())
    expect(await isStillPending(SongPage({ params: { id: 'minato' } }))).toBe(true)
  })
})

describe('B 参加：読み込み中とエラー', () => {
  const at = (state: string) => ({ params: { id: 'yoake' }, searchParams: { step: 'submit', state } })

  it('読み込み中は、押せない「送っています」だけ', async () => {
    const html = await render(JoinPage, at('sending'))
    expect(html).toContain('data-screen="join-sending"')
    expect(html).toContain('送っています')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('エラーは「送れませんでした」「通信がつながりませんでした。」と［もう一度］［やめる］', async () => {
    const html = await render(JoinPage, at('error'))
    expect(html).toContain('data-screen="join-error"')
    expect(html).toContain('送れませんでした')
    expect(html).toContain('通信がつながりませんでした。')
    expect(html).toContain(COPY.retry)
    expect(html).toContain('やめる')
    // 主ボタンは「もう一度」の1つだけ
    expect(count(html, 'data-ui="primary"')).toBe(1)
  })

  it('★短い方の通信の文言を使う（歌の画面の長い文言を混ぜない）', async () => {
    const html = await render(JoinPage, at('error'))
    expect(html).not.toContain('電波のよい所で')
  })

  it('落ちる読み口だと、参加の画面は投げる', async () => {
    restore = setUiDataSource(failingSource())
    await expect(JoinPage({ params: { id: 'yoake' }, searchParams: {} })).rejects.toThrow()
  })
})

describe('C 量を選ぶ：読み込み中・エラー・結果を確認しています', () => {
  it('読み込み中は、あなたの TYP の所が「確かめています」で、前の数字を出さない', async () => {
    const html = await render(ThanksLoading)
    expect(html).toContain('data-screen="thanks-loading"')
    expect(html).toContain('あなたの TYP')
    expect(html).toContain('確かめています')
    expect(html).not.toContain('1,200')
    // 押せない［確認へ］（主ボタンは置かない）
    expect(html).toContain('確認へ')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('エラーは「いまの TYP を確かめられませんでした」と［もう一度］（本文は足さない）', async () => {
    const html = await render(ThanksError, boom)
    expect(html).toContain('いまの TYP を確かめられませんでした')
    expect(html).toContain(COPY.retry)
    expect(html).not.toContain('通信がつながりませんでした')
  })

  it('結果を確認しています：「次のありがとうは贈れません。」を出し、［確認へ］を出さない', async () => {
    const pending = {
      ...sampleSource,
      isSample: true,
      async getSong(id: string) {
        const song = await sampleSource.getSong(id)
        return song ? { ...song, gift: { ...song.gift, pendingResult: true } } : null
      },
    } as UiDataSource
    restore = setUiDataSource(pending)
    const html = await render(ThanksPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('前のありがとうの結果を確認しています。結果がわかるまで、次のありがとうは贈れません。')
    expect(html).toContain('data-state="checking"')
    expect(html).not.toContain('確認へ')
  })

  it('落ちる読み口だと、量を選ぶ画面は投げる', async () => {
    restore = setUiDataSource(failingSource())
    await expect(ThanksPage({ params: { id: 'minato' }, searchParams: {} })).rejects.toThrow()
  })
})

describe('F 参加者の同意：読み込み中とエラー', () => {
  it('読み込み中は、見出しと枠だけ', async () => {
    const html = await render(ConsentLoading)
    expect(html).toContain('data-screen="consent-loading"')
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('対応待ちへ')
  })

  it('エラーは「同意を送れませんでした」「通信がつながりませんでした。」と［もう一度］', async () => {
    const html = await render(ConsentPage, { params: { id: 'ame' }, searchParams: { state: 'error' } })
    expect(html).toContain('data-screen="consent-error"')
    expect(html).toContain('同意を送れませんでした')
    expect(html).toContain('通信がつながりませんでした。')
    expect(html).not.toContain('電波のよい所で')
    // 主ボタンは「もう一度」の1つだけ
    expect(count(html, 'data-ui="primary"')).toBe(1)
  })

  it('落ちる読み口だと、同意の画面は投げる', async () => {
    restore = setUiDataSource(failingSource())
    await expect(ConsentPage({ params: { id: 'ame' }, searchParams: {} })).rejects.toThrow()
  })
})

describe('I 自分：読み込み中とエラー', () => {
  it('読み込み中は、見出しと枠', async () => {
    const html = await render(MeLoading)
    expect(html).toContain('data-screen="me-loading"')
    expect(html).toContain('自分')
    expect(html).toContain('data-state="loading"')
  })

  it('エラーは「読み込めませんでした」「通信がつながりませんでした。」と［もう一度］', async () => {
    const html = await render(MeError, boom)
    expect(html).toContain('読み込めませんでした')
    expect(html).toContain('通信がつながりませんでした。')
    expect(html).not.toContain('電波のよい所で')
    expect(html).toContain(COPY.retry)
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('落ちる読み口だと、自分の画面は投げる', async () => {
    restore = setUiDataSource(failingSource())
    await expect(MePage()).rejects.toThrow()
  })

  it('遅い読み口だと、自分の画面はまだ答えを返さない', async () => {
    restore = setUiDataSource(slowSource())
    expect(await isStillPending(MePage())).toBe(true)
  })
})

describe('枠が Next の決まりの場所に置かれている', () => {
  const files = [
    'app/ui/songs/[id]/loading.tsx',
    'app/ui/songs/[id]/error.tsx',
    'app/ui/songs/[id]/thanks/loading.tsx',
    'app/ui/songs/[id]/thanks/error.tsx',
    'app/ui/inbox/consent/[id]/loading.tsx',
    'app/ui/me/loading.tsx',
    'app/ui/me/error.tsx',
  ]
  it('読み込み中とエラーの枠が、画面と同じ所に在る', () => {
    const missing = files.filter((f) => !existsSync(path.join(ROOT, f)))
    expect(missing).toEqual([])
  })
})
