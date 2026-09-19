import { describe, it, expect } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { createRequire } from 'node:module'

// react-dom/server の型（@types/react-dom）は依存に入っていないので、型を付けて読み込む。
// ★package.json を変えない（PR #4〜#6 と重ならないため）。
const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: ReactElement) => string
}
import {
  COLORS,
  CONTRAST_PAIRS,
  contrastRatio,
  COPY,
  ConfirmDialog,
  giftGate,
  GhostButton,
  Icon,
  ICON_NAMES,
  ScreenFrame,
  SecondaryButton,
  StateView,
  UnavailableButton,
  Y4_PHASE,
  type GiftGateInput,
  type StateKind,
} from './index'
import * as publicApi from './index'

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('色と文字の決まり', () => {
  it('Teal は案B（#0A7C74）', () => {
    expect(COLORS.teal).toBe('#0A7C74')
  })
  it('設計書 §2-2 の組み合わせは、すべて基準のコントラスト比を満たす', () => {
    for (const p of CONTRAST_PAIRS) {
      expect(contrastRatio(p.fg, p.bg), p.name).toBeGreaterThanOrEqual(p.min)
    }
  })
  it('計算は設計書の値と合う（主ボタンの白い文字 5.06・本文 15.13）', () => {
    expect(contrastRatio(COLORS.onTeal, COLORS.teal)).toBeCloseTo(5.06, 2)
    expect(contrastRatio(COLORS.ink, COLORS.bg)).toBeCloseTo(15.13, 2)
  })
})

describe('主ボタンは1画面1つ', () => {
  it('主ボタンの部品はフォルダの外へ出していない', () => {
    expect('PrimaryButton' in publicApi).toBe(false)
  })
  it('画面の枠は、主ボタンを1つだけ置く', () => {
    const html = renderToStaticMarkup(
      h(ScreenFrame, {
        title: '贈る前の確認',
        back: { href: '/x', label: '戻る' },
        primary: { kind: 'action', label: '贈る', icon: 'gift' },
        secondary: h(GhostButton, { label: '戻る' }),
      }),
    )
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('data-ui="back"')
  })
  it('確認の小窓も、主ボタンは確認の1つだけで、戻る道がある', () => {
    const html = renderToStaticMarkup(
      h(ConfirmDialog, { open: true, inline: true, title: '公開しますか', body: '公開すると、誰でも聴けるようになります。', confirmLabel: '公開する' }),
    )
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('data-ui="ghost"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-labelledby=')
  })
  it('閉じているときは何も出さない', () => {
    expect(renderToStaticMarkup(h(ConfirmDialog, { open: false, title: 't', body: 'b', confirmLabel: 'c' }))).toBe('')
  })
})

describe('押せないボタン', () => {
  it('押せない理由の1文をボタンの下に出し、読み上げでも結び付ける', () => {
    const html = renderToStaticMarkup(h(UnavailableButton, { label: '公開する', reason: 'りくさんの同意を待っています。' }))
    expect(html).toContain('disabled=""')
    expect(html).toContain('りくさんの同意を待っています。')
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
  })
  it('同じ中身なら、何度描いても同じ id（サーバーと画面で食い違わない）', () => {
    const a = renderToStaticMarkup(h(UnavailableButton, { label: 'x', reason: 'y' }))
    const b = renderToStaticMarkup(h(UnavailableButton, { label: 'x', reason: 'y' }))
    expect(a).toBe(b)
  })
  it('画面の枠の主ボタンを「押せない」にすると、理由が必ず付く', () => {
    const html = renderToStaticMarkup(
      h(ScreenFrame, { presentation: 'sheet', primary: { kind: 'unavailable', label: '確認へ', reason: '量を選んでください。' } }),
    )
    expect(html).toContain('量を選んでください。')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })
  it('押した直後は「〇〇しています」で押せなくなる', () => {
    const html = renderToStaticMarkup(h(ScreenFrame, { presentation: 'sheet', primary: { kind: 'busy', label: '贈っています' } }))
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('贈っています')
  })
})

describe('状態の枠', () => {
  const kinds: StateKind[] = ['loading', 'empty', 'error', 'checking', 'unavailable-y4', 'not-ready']
  it('6つの状態を出せる', () => {
    for (const kind of kinds) {
      const html = renderToStaticMarkup(h(StateView, { kind, message: kind === 'empty' ? 'まだありません。' : undefined }))
      expect(html, kind).toContain(`data-state="${kind}"`)
    }
  })
  it('設計書の言葉を初期値にする', () => {
    expect(renderToStaticMarkup(h(StateView, { kind: 'error' }))).toContain(COPY.networkError)
    expect(renderToStaticMarkup(h(StateView, { kind: 'checking' }))).toContain('結果を確認しています')
    expect(renderToStaticMarkup(h(StateView, { kind: 'unavailable-y4' }))).toContain(COPY.giftUnavailableY4)
    expect(renderToStaticMarkup(h(StateView, { kind: 'not-ready' }))).toContain('いまは表示できません')
  })
  it('エラーは読み上げに強く伝える（alert）。［もう一度］はエラー・準備中にだけ出す', () => {
    const err = renderToStaticMarkup(h(StateView, { kind: 'error', retry: { href: '#' } }))
    expect(err).toContain('role="alert"')
    expect(err).toContain(COPY.retry)
    expect(renderToStaticMarkup(h(StateView, { kind: 'checking', retry: { href: '#' } }))).not.toContain(COPY.retry)
  })
  it('Y4 暫定は「あとで外す物」の印を持ち、札は部品一覧でだけ出す', () => {
    const prod = renderToStaticMarkup(h(StateView, { kind: 'unavailable-y4' }))
    expect(prod).toContain('data-provisional="y4"')
    expect(prod).not.toContain(COPY.tagY4Provisional)
    expect(renderToStaticMarkup(h(StateView, { kind: 'unavailable-y4', showDesignMarks: true }))).toContain(COPY.tagY4Provisional)
  })
})

describe('ありがとうを贈るの出し分け（Y4 の1つの条件）', () => {
  const base: GiftGateInput = {
    ruleEstablished: true,
    selfIsParticipant: false,
    selfIsRecipient: false,
    receivableCount: 3,
    unreceivableCount: 0,
    pendingResult: false,
  }
  it('今は Y4 本番受入の前（暫定）', () => {
    expect(Y4_PHASE).toBe('before-acceptance')
  })
  it('受け取れない方がいる歌：受入の前は利用不可、後は贈れて確定の文言を出す', () => {
    expect(giftGate({ ...base, unreceivableCount: 1, phase: 'before-acceptance' })).toEqual({
      kind: 'unavailable-y4',
      reason: COPY.giftUnavailableY4,
    })
    expect(giftGate({ ...base, unreceivableCount: 1, phase: 'after-acceptance' })).toEqual({
      kind: 'available',
      note: '受け取れない方の分は送られず、あなたのポイントからも減りません',
    })
  })
  it('受け取れない方がいなければ、受入の前も後も贈れる', () => {
    expect(giftGate({ ...base, phase: 'before-acceptance' })).toEqual({ kind: 'available' })
    expect(giftGate({ ...base, phase: 'after-acceptance' })).toEqual({ kind: 'available' })
  })
  it('自分が参加している・届け先に入っている歌は、受入の後も贈れない（恒久の決まり）', () => {
    for (const phase of ['before-acceptance', 'after-acceptance'] as const) {
      expect(giftGate({ ...base, selfIsRecipient: true, unreceivableCount: 1, phase }).kind).toBe('unavailable-self')
      expect(giftGate({ ...base, selfIsParticipant: true, phase }).kind).toBe('unavailable-self')
    }
  })
  it('届け方が成立していない・受け取れる人がいない歌にはボタンを出さない', () => {
    expect(giftGate({ ...base, ruleEstablished: false })).toEqual({ kind: 'hidden' })
    expect(giftGate({ ...base, receivableCount: 0, unreceivableCount: 2 })).toEqual({ kind: 'hidden' })
  })
  it('前の贈与の結果を確認している間は贈れない（二重に贈らない）', () => {
    expect(giftGate({ ...base, pendingResult: true })).toEqual({ kind: 'checking', reason: COPY.giftPending })
  })
})

describe('線のアイコン', () => {
  it('どのアイコンも線で描き、読み上げには出さない', () => {
    for (const name of ICON_NAMES) {
      const html = renderToStaticMarkup(h(Icon, { name }))
      expect(html, name).toContain('aria-hidden="true"')
      expect(html, name).toContain('stroke-width="1.7"')
    }
  })
  it('ボタンの中のアイコンは、必ず文字と一緒に出る', () => {
    const html = renderToStaticMarkup(h(SecondaryButton, { label: 'この曲に参加する', icon: 'join' }))
    expect(html).toContain('この曲に参加する')
    expect(html).toContain('data-icon="join"')
  })
})
