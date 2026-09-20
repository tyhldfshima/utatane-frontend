import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement as h, type ReactElement } from 'react'
import { createRequire } from 'node:module'
import { AppShell } from '@/components/ui/AppShell'
import { SIZES } from '@/components/ui'
import SongPage from './songs/[id]/page'
import JoinPage from './songs/[id]/join/page'
import GrowPage from './songs/[id]/grow/page'
import ThanksPage from './songs/[id]/thanks/page'
import TreePage from './songs/[id]/tree/page'
import DraftPage from './drafts/[id]/page'
import ConsentPage from './inbox/consent/[id]/page'
import PublishPage from './drafts/[id]/publish/page'
import DraftMaterialsPage from './drafts/[id]/materials/page'
import AskPage from './songs/[id]/grow/ask/page'
import InboxPage from './inbox/page'
import MePage from './me/page'
import ProfilePage from './me/profile/page'
import HomePage from './page'
import CreatePage from './create/page'

// 押しやすさの試験（設計書 docs/design/utatane-focus-screens-spec.md §2-1）。
//   「押せる物の高さ：主ボタン・ボタン 52px／小さなボタン・文字のリンク・戻る 44px 以上」
//
// ★ここでは実際の画面を描いて、押せる物（リンク・ボタン）のクラスを取り出し、
//   そのクラスに書かれた高さの決まりが 44px 以上かを見る。
//   ブラウザを使わずに「仕組みで見られる範囲」を見る試験なので、
//   高さを決める書き方（min-height／height）が1つも無い押せる物も、落とす。
// ★ブラウザでの実測は便の報告に載せる（Playwright）。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}

// ---- CSS の決まりを読む ----

const CSS_FILES = ['components/ui/ui.module.css', 'components/ui/shell.module.css']

/** var(--u-button) などを、決めてある値（components/ui/tokens.ts）に戻す */
function resolveSize(value: string): number | null {
  const v = value.trim()
  const token = /^var\(\s*(--u-[a-z-]+)\s*\)$/.exec(v)
  if (token) {
    if (token[1] === '--u-button') return SIZES.button
    if (token[1] === '--u-min-touch') return SIZES.minTouch
    return null
  }
  const px = /^(\d+(?:\.\d+)?)px$/.exec(v)
  return px ? Number(px[1]) : null
}

/**
 * クラスごとの「決められた高さ」を集める。
 * ＠media の中も同じように数える（中の決まりの方が後に効くが、どちらも 44px 以上であってほしい）。
 * 1つのクラスに複数の決まりがあるときは、いちばん小さい値を取る（いちばん小さい所で押しやすさが決まる）。
 */
export function declaredHeights(css: string): Map<string, number> {
  const out = new Map<string, number>()
  // 「選ぶ所 { 中身 }」を順に取り出す。＠media の行は選ぶ所ではないので飛ばす。
  const rule = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = rule.exec(css)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (selector.startsWith('@')) continue
    const size = /(?:^|[;\s])(?:min-height|height)\s*:\s*([^;]+)/.exec(body)
    if (!size) continue
    const px = resolveSize(size[1])
    if (px === null) continue
    for (const one of selector.split(',')) {
      // 的はいちばん後ろの1語。「.rail .logo」は .logo が的。
      // 「.choice input」は中の input が的なので、クラスの決まりとして数えない。
      // 「.tabOn::after」は飾りの線で、押せる物そのものではないので数えない。
      const parts = one.trim().split(/\s+/)
      const last = parts[parts.length - 1]
      if (!last.startsWith('.') || last.includes('::')) continue
      const classes = last.match(/\.[A-Za-z][\w-]*/g)
      if (!classes) continue
      const name = classes[classes.length - 1].slice(1)
      const before = out.get(name)
      out.set(name, before === undefined ? px : Math.min(before, px))
    }
  }
  return out
}

const HEIGHTS = (() => {
  const all = new Map<string, number>()
  for (const f of CSS_FILES) {
    declaredHeights(readFileSync(f, 'utf8')).forEach((v, k) => {
      const before = all.get(k)
      all.set(k, before === undefined ? v : Math.min(before, v))
    })
  }
  return all
})()

// ---- 描いた画面から、押せる物を取り出す ----

type Tap = { tag: string; classes: string[]; text: string }

/** 描いた画面の中の、押せる物（リンク・ボタン）を集める */
export function tapTargets(html: string): Tap[] {
  const out: Tap[] = []
  const tag = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = tag.exec(html)) !== null) {
    const attrs = m[2]
    if (/\bdisabled\b/.test(attrs)) continue // 押せないボタンは押す物ではない
    if (m[1] === 'a' && !/\shref=/.test(attrs)) continue
    const cls = /\bclass="([^"]*)"/.exec(attrs)
    out.push({
      tag: m[1],
      classes: cls ? cls[1].split(/\s+/).filter(Boolean) : [],
      text: m[3].replace(/<[^>]*>/g, '').trim().slice(0, 24),
    })
  }
  return out
}

/**
 * 描いたときのクラス名を、CSS に書いてある名前に戻す。
 * 試験の道具は CSS のクラスに印をつけるので（例「_button_2186ff」）、その印を外す。
 */
export function baseName(cls: string): string {
  const m = /^_(.+)_[0-9a-z]+$/.exec(cls)
  return m ? m[1] : cls
}

/** その押せる物に決められている高さ（決まりが1つも無ければ null） */
export function heightOf(t: Tap): number | null {
  let best: number | null = null
  for (const c of t.classes) {
    const px = HEIGHTS.get(baseName(c))
    if (px === undefined) continue
    if (best === null || px > best) best = px
  }
  return best
}

// ---- 画面を全部そろえる ----

const song = (id: string) => ({ params: { id }, searchParams: {} })

const SCREENS: { name: string; html: () => Promise<string> }[] = [
  { name: 'ホーム', html: () => render(HomePage) },
  { name: '＋つくる', html: () => render(CreatePage) },
  { name: '対応待ち', html: () => render(InboxPage) },
  { name: '自分', html: () => render(MePage) },
  { name: '公開プロフィール', html: () => render(ProfilePage) },
  { name: '歌の画面', html: () => render(SongPage, song('minato')) },
  { name: '歌の画面（募集なし）', html: () => render(SongPage, song('futatabi')) },
  { name: 'この歌が生まれた流れ', html: () => render(TreePage, song('minato')) },
  { name: '参加（何で参加するか）', html: () => render(JoinPage, song('minato')) },
  { name: '参加（送る）', html: () => render(JoinPage, { params: { id: 'minato' }, searchParams: { step: 'submit', role: 'chorus' } }) },
  { name: '参加（送りました）', html: () => render(JoinPage, { params: { id: 'minato' }, searchParams: { step: 'sent', role: 'guitar' } }) },
  { name: '参加（募集が1つ）', html: () => render(JoinPage, song('yoake')) },
  { name: '育てる（何を受け継ぐか）', html: () => render(GrowPage, song('minato')) },
  { name: '育てる（お願いの内容）', html: () => render(AskPage, { params: { id: 'minato' }, searchParams: { take: ['c-lyrics', 'c-melody'] } }) },
  { name: '育てる（お願いを送った後）', html: () => render(AskPage, { params: { id: 'minato' }, searchParams: { take: 'c-melody', step: 'sent' } }) },
  { name: '育てる（お願いのエラー）', html: () => render(AskPage, { params: { id: 'minato' }, searchParams: { take: 'c-melody', state: 'error' } }) },
  { name: '育てる（何を加えるか）', html: () => render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'add', take: 'c-lyrics' } }) },
  { name: '制作中の歌（参加した先）', html: () => render(DraftPage, { params: { id: 'minato-join' }, searchParams: { sent: 'guitar' } }) },
  { name: '制作中の歌（育てて作った）', html: () => render(DraftPage, { params: { id: 'new' }, searchParams: { from: 'minato', take: 'c-lyrics', add: 'vocal' } }) },
  { name: 'ありがとう（量を選ぶ）', html: () => render(ThanksPage, song('minato')) },
  { name: 'ありがとう（贈る前の確認）', html: () => render(ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'confirm', amount: '300' } }) },
  { name: 'ありがとう（結果）', html: () => render(ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300' } }) },
  { name: 'ありがとう（利用不可）', html: () => render(ThanksPage, song('futatabi')) },
  { name: '参加者の同意', html: () => render(ConsentPage, song('ame')) },
  { name: '参加者の同意（小窓）', html: () => render(ConsentPage, { params: { id: 'ame' }, searchParams: { confirm: '1' } }) },
  { name: '参加者の同意（完了）', html: () => render(ConsentPage, { params: { id: 'ame' }, searchParams: { done: '1' } }) },
  { name: '参加者の同意（エラー）', html: () => render(ConsentPage, { params: { id: 'ame' }, searchParams: { state: 'error' } }) },
  { name: '主催が公開する（同意を待っている）', html: () => render(PublishPage, song('ame')) },
  { name: '主催が公開する（同意がそろった）', html: () => render(PublishPage, song('hare')) },
  { name: '主催が公開する（小窓）', html: () => render(PublishPage, { params: { id: 'hare' }, searchParams: { confirm: '1' } }) },
  { name: '主催が公開する（エラー）', html: () => render(PublishPage, { params: { id: 'hare' }, searchParams: { state: 'error' } }) },
  { name: '主催が公開する（完了）', html: () => render(PublishPage, { params: { id: 'hare' }, searchParams: { done: '1' } }) },
  { name: '主催が公開する（素材がまだ）', html: () => render(PublishPage, song('hoshi')) },
  { name: '素材と元の歌（一覧）', html: () => render(DraftMaterialsPage, song('hoshi')) },
  { name: '素材の出どころを申告する', html: () => render(DraftMaterialsPage, { params: { id: 'hoshi' }, searchParams: { material: 'm-hoshi' } }) },
]

describe('押せる物は 44px 以上（設計書 §2-1）', () => {
  it('決まりの値そのもの（押せる物の最小 44px・ボタン 52px）', () => {
    expect(SIZES.minTouch).toBe(44)
    expect(SIZES.button).toBe(52)
  })

  it('上の帯と左の縦メニューの「UTATANE」は、押せる高さが 44px 以上', () => {
    const html = renderToStaticMarkup(h(AppShell, { children: null }))
    const logos = tapTargets(html).filter((t) => t.text === 'UTATANE')
    expect(logos.length).toBeGreaterThanOrEqual(2) // 上の帯（スマホ）と左の縦メニュー（PC）
    for (const t of logos) expect(heightOf(t), t.text).toBeGreaterThanOrEqual(SIZES.minTouch)
  })

  it('画面の枠（下のタブ・再生バー・上の帯）の押せる物が、すべて 44px 以上', () => {
    const html = renderToStaticMarkup(h(AppShell, { children: null }))
    const small = tapTargets(html).filter((t) => (heightOf(t) ?? 0) < SIZES.minTouch)
    expect(small.map((t) => `${t.tag}.${t.classes.join('.')}「${t.text}」`)).toEqual([])
  })

  it.each(SCREENS)('$name の押せる物が、すべて 44px 以上', async ({ html }) => {
    const found = tapTargets(await html())
    expect(found.length).toBeGreaterThan(0)
    const small = found.filter((t) => (heightOf(t) ?? 0) < SIZES.minTouch)
    expect(small.map((t) => `${t.tag}.${t.classes.join('.')}「${t.text}」`)).toEqual([])
  })

  it('ステップの札は押せる物にしない（試作・設計書 §3 F のとおり）', async () => {
    for (const id of ['ame']) {
      const html = await render(ConsentPage, song(id))
      expect(html).toContain('<li>1 あなたの音</li>')
      expect(html).not.toContain('href="#step-1"')
    }
  })
})

describe('この試験が空振りしないこと', () => {
  it('高さの決まりが 44px 未満なら落とす', () => {
    const css = '.logo { min-height: 31px; }'
    expect(declaredHeights(css).get('logo')).toBe(31)
  })
  it('高さの決まりが1つも無い押せる物は、44px 以上と数えない', () => {
    expect(heightOf({ tag: 'a', classes: [], text: '1 あなたの音' })).toBeNull()
    expect(heightOf({ tag: 'a', classes: ['steps'], text: '1 あなたの音' })).toBeNull()
  })
  it('押せる物を拾えている（拾えなければ、どの画面も素通りしてしまう）', () => {
    const html = '<a class="button primary" href="/x">贈る</a><button class="button" disabled>押せない</button><a>印</a>'
    const found = tapTargets(html)
    expect(found.map((t) => t.text)).toEqual(['贈る'])
    expect(heightOf(found[0])).toBe(SIZES.button)
  })
  it('決まりの読み取りが var(--u-button) を 52 に戻せている', () => {
    expect(declaredHeights('.button { min-height: var(--u-button); }').get('button')).toBe(SIZES.button)
    expect(declaredHeights('.back { min-height: var(--u-min-touch); }').get('back')).toBe(SIZES.minTouch)
  })
})
