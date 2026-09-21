import { describe, it, expect, afterEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { createRequire } from 'node:module'
import MePage from './me/page'
import { COPY, StateView, loginHref } from '@/components/ui'
import { createSampleSource, setUiDataSource } from '@/lib/ui-data'
import { SAMPLE, type SampleData } from '@/lib/preview/sample'

// 画面寄せの設計（docs/design/utatane-screen-consolidation.md）の段1・段2。
//
// ★段1（設計①）… 「ログインが要る」の1状態と文言。★画面は作らない。
//   `/login` は PR #4 が作り直す物で、ここは**導線だけ**。
// ★段2（設計②）… app/ui/me に「TYポイントで残高と履歴を見る」の1行。
//   ★残高の数字は置かない（941be1bd の決まり）。読むのは TYポイント側の画面（H・担当外）。
//
// ★設計に無いものは足していない。旧組の画面も1枚も消していない。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

let restore: (() => void) | null = null
const fresh = () => {
  restore?.()
  restore = setUiDataSource(createSampleSource(clone()))
}
afterEach(() => {
  restore?.()
  restore = null
})

// ── 段1：「ログインが要る」の1状態と文言 ───────────────────────

describe('段1：ログインが要るときの見せ方', () => {
  it('新しい状態が出て、設計どおりの文言と［ログインする］を出す', () => {
    const html = renderToStaticMarkup(h(StateView, { kind: 'login-required' }))
    expect(html).toContain('data-state="login-required"')
    expect(html).toContain(COPY.loginRequired)
    // ★［ログインする］は「ボタンとして」出ていることを見る。
    //   ★説明文（COPY.loginRequired）の中にも「ログインする」という字が入っているので、
    //     字が在るかだけでは確かめられない。
    expect(html).toContain('data-ui="secondary"')
    expect(html).toContain('href="/login"')
  })

  it('★ログインの後、元の画面へ戻す（?next= で渡す）', () => {
    const html = renderToStaticMarkup(h(StateView, { kind: 'login-required', loginNext: '/ui/materials' }))
    expect(html).toContain('href="/login?next=%2Fui%2Fmaterials"')
  })

  it('戻り先を渡さないときは、素の /login へ送る', () => {
    expect(loginHref()).toBe('/login')
    expect(loginHref('/ui/me')).toBe('/login?next=%2Fui%2Fme')
    // ★住所に使えない字は、そのまま混ぜない
    expect(loginHref('/ui/songs/a b?x=1')).toBe('/login?next=%2Fui%2Fsongs%2Fa%20b%3Fx%3D1')
  })

  it('★画面は作っていない（この状態は部品の中だけ）', () => {
    // ほかの状態に［ログインする］が混ざっていないこと
    for (const kind of ['empty', 'error', 'checking', 'not-ready'] as const) {
      const html = renderToStaticMarkup(h(StateView, { kind }))
      expect(`${kind}:${html.includes(COPY.loginButton)}`).toBe(`${kind}:false`)
    }
  })

  it('★「もう一度」と取り違えない（別の状態・別の言葉）', () => {
    const html = renderToStaticMarkup(h(StateView, { kind: 'login-required' }))
    expect(html).not.toContain(COPY.retry)
    expect(COPY.loginButton).not.toBe(COPY.retry)
  })
})

// ── 段2：app/ui/me に TYポイントへの1行 ────────────────────────

describe('段2：自分の画面から TYポイントへ行ける', () => {
  it('設計どおりの1行が出て、TYポイントの画面へ送る', async () => {
    fresh()
    const html = await render(MePage as never)
    expect(html).toContain('data-link="typ"')
    expect(html).toContain(COPY.typLink)
    expect(html).toContain('point.ty-hld.com')
  })

  it('★残高の数字を1つも置かない（941be1bd の決まり）', async () => {
    fresh()
    const html = await render(MePage as never)
    // 「1,200 TYP」のような、数字のついた残高を出さない
    expect(html).not.toMatch(/[\d,]+\s*TYP/)
  })

  it('★贈る・換金・寄付の入口を置かない（中央または MVP 外）', async () => {
    fresh()
    const html = await render(MePage as never)
    for (const entry of ['贈る', '換金', '寄付']) {
      expect(`${entry}:${html.includes(entry)}`).toBe(`${entry}:false`)
    }
  })

  it('★行き先は1つだけ（この画面で TYポイントを読み書きしない）', async () => {
    fresh()
    const html = await render(MePage as never)
    expect(html.split('point.ty-hld.com').length - 1).toBe(1)
    expect(html.split('data-link="typ"').length - 1).toBe(1)
  })
})
