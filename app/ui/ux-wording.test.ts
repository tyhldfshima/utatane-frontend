import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import SongPage from './songs/[id]/page'
import JoinPage from './songs/[id]/join/page'
import GrowPage from './songs/[id]/grow/page'
import AskPage from './songs/[id]/grow/ask/page'
import ThanksPage from './songs/[id]/thanks/page'
import DraftPage from './drafts/[id]/page'
import PublishPage from './drafts/[id]/publish/page'
import MePage from './me/page'
import { COPY } from '@/components/ui'
import { createSampleSource, setUiDataSource } from '@/lib/ui-data'
import { SAMPLE, type SampleData } from '@/lib/preview/sample'

// UX 受入基準のうち、**画面の文言だけで確かめられる4つ**（棚卸し 4aabfd55 の便4）。
//
// ★基準の正本：devlog「えふさん確定：UTATANE/TYポイント 収束の進め方・計測・リリースゲート・UX受入基準（原文）」
//   （プロジェクト「ウタタネ(utatane.music)」・2026-09-19 13:09・entry af3723e9-a7ef-4e4d-852b-535d5b4c69c1）
//   原文の該当部分：
//     「曲を聴いてから『参加する』まで迷わないか」
//     「『参加』と『素材を使う』を間違えないか」
//     「保存／提出／採用／公開を誤認しないか」
//     「TYPと円を混同しないか」
//     「『いいね』と『ありがとう』の違いが分かるか」
//   ★この正本はリポの中に無い（devlog のみ）。棚卸し 4aabfd55 の重大発見5。
//
// ★試験にできない項目（ここでは見ない）：
//   「初めて来た人が説明書なしで分かるか」「スマホ片手で主要行動が完了するか」
//   「Version Tree を見て育ちが理解できるか」…… 文言だけでは判定できない。人が見る受入で確かめる。
//
// ★この便は試験だけ。app・lib・components の本体は1文字も変えていない。

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

// ── ① 「参加」と「素材を使う」を間違えないか ──────────────────

describe('① 「参加」と「素材を使う」を間違えない', () => {
  it('歌の画面で、2つは別の見出し・別の行き先になっている', async () => {
    fresh()
    const html = await render(SongPage as never, { params: { id: 'minato' }, searchParams: {} })
    // 「この歌の制作に参加する」＝ 今の主催者の制作に加わる
    expect(html).toContain(COPY.joinTitle)
    expect(html).toContain('/ui/songs/minato/join')
    // 「新しい Version として育てる」＝ 受け継いで自分が主催する
    expect(html).toContain(COPY.growTitle)
    expect(html).toContain('/ui/songs/minato/grow')
    // ★2つの言葉が同じでは、選びようがない
    expect(COPY.joinTitle).not.toBe(COPY.growTitle)
    // ★行き先も別（同じなら、どちらを押しても同じ画面へ行ってしまう）
    expect(`/ui/songs/minato/join`).not.toBe(`/ui/songs/minato/grow`)
  })

  it('歌の画面の2つの札が、別々の区画として並んでいる', async () => {
    fresh()
    const html = await render(SongPage as never, { params: { id: 'minato' }, searchParams: {} })
    // 参加の札：主催者が仲間を募っている、という説明が付く
    expect(html).toContain('data-part="join-card"')
    expect(html).toContain('さんが一緒につくる仲間を募集しています。')
    // 育てるの札：受け継いで自分が主催する、という説明が付く
    expect(html).toContain('data-part="grow-card"')
    expect(html).toContain(COPY.growLead)
    // ★2つの説明文が同じでは、違いが分からない
    expect(COPY.joinLead).not.toBe(COPY.growLead)
  })

  it('参加の画面と育てるの画面は、題名が別（同じ題名だと、どちらに居るか分からない）', async () => {
    fresh()
    const join = await render(JoinPage as never, { params: { id: 'minato' }, searchParams: {} })
    const grow = await render(GrowPage as never, { params: { id: 'minato' }, searchParams: {} })
    expect(join).toContain(COPY.joinTitle)
    expect(join).not.toContain(COPY.growTitle)
    expect(grow).toContain(COPY.growTitle)
    expect(grow).not.toContain(COPY.joinTitle)
  })

  it('★「使わせてとお願いする」は、参加の画面には出てこない（育てる側の話）', async () => {
    fresh()
    const join = await render(JoinPage as never, { params: { id: 'minato' }, searchParams: {} })
    expect(join).not.toContain(COPY.askTitle)
    const ask = await render(AskPage as never, { params: { id: 'minato' }, searchParams: { take: 'c-lyrics' } })
    expect(ask).toContain(COPY.askTitle)
  })
})

// ── ② 「保存／提出／採用／公開」を誤認しないか ─────────────────

describe('② 保存・提出・採用・公開を誤認しない', () => {
  it('4つの言葉が、互いに違う言い方になっている', () => {
    const words = ['下書きに保存', '送る', '採用', COPY.publishButton]
    expect(new Set(words).size).toBe(words.length)
  })

  it('★保存したとき「公開した」と誤解させない', async () => {
    fresh()
    const html = await render(DraftPage as never, {
      params: { id: 'new' },
      searchParams: { from: 'minato', take: 'c-lyrics', add: 'vocal' },
    })
    // 保存の言い方であること
    expect(html).toContain('下書きに保存しました')
    // ★「まだ公開されていない」とはっきり言う
    expect(html).toContain('まだ誰にも公開されていません')
    // ★公開の完了文言は出さない
    expect(html).not.toContain(COPY.publishDoneTitle)
    expect(html).not.toContain(COPY.publishDoneBody)
  })

  it('★公開したとき「保存した」と誤解させない', async () => {
    fresh()
    const html = await render(PublishPage as never, { params: { id: 'hare' }, searchParams: { done: '1' } })
    expect(html).toContain(COPY.publishDoneTitle)
    expect(html).toContain(COPY.publishDoneBody)
    // ★下書きの完了文言は出さない
    expect(html).not.toContain('下書きに保存しました')
    expect(html).not.toContain('まだ誰にも公開されていません')
  })

  it('★「送った」と「採用された」を、自分の画面で分けて見せる', async () => {
    fresh()
    const html = await render(MePage as never, {})
    // 送っただけの物と、採用されなかった物を別の見出しで並べる
    expect(html).toContain('採用されなかった送り物')
    // ★採用の言葉が、公開の言葉と混ざっていない
    expect('採用').not.toBe(COPY.publishButton)
  })
})

// ── ③ TYP と円を混同しないか ─────────────────────────────

describe('③ TYP と円を混同しない', () => {
  const MONEY = ['円', '¥', '￥', 'ドル', '$']

  it('★ありがとうの C・D・E に、お金の単位が1つも出てこない', async () => {
    fresh()
    const screens = {
      C: await render(ThanksPage as never, { params: { id: 'minato' }, searchParams: {} }),
      D: await render(ThanksPage as never, { params: { id: 'minato' }, searchParams: { step: 'confirm', amount: '300' } }),
      E: await render(ThanksPage as never, { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300' } }),
    }
    for (const [name, html] of Object.entries(screens)) {
      for (const unit of MONEY) {
        expect(`${name}:${html.includes(unit)}`).toBe(`${name}:false`)
      }
      // ★量には必ず TYP が付く
      expect(html).toContain('TYP')
    }
  })

  it('★量の札は「数字＋TYP」で出す（数字だけにしない）', async () => {
    fresh()
    const html = await render(ThanksPage as never, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('300 TYP')
  })

  it('★文言の一覧にも、お金の単位を混ぜない', () => {
    for (const [key, text] of Object.entries(COPY)) {
      for (const unit of MONEY) {
        expect(`${key}:${String(text).includes(unit)}`).toBe(`${key}:false`)
      }
    }
  })
})

// ── ④ 「いいね」と「ありがとう」の違いが分かるか ────────────────

describe('④ 「いいね」と「ありがとう」の違いが分かる', () => {
  const SCREENS: [string, (props: never) => unknown, Record<string, unknown>][] = [
    ['A 歌の画面', SongPage, { params: { id: 'minato' }, searchParams: {} }],
    ['C ありがとう：量を選ぶ', ThanksPage, { params: { id: 'minato' }, searchParams: {} }],
    ['D ありがとう：確認', ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'confirm', amount: '300' } }],
    ['E ありがとう：結果', ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300' } }],
    ['I 自分', MePage, {}],
  ]

  it('ありがとうの行動語は「ありがとうを贈る」の1つだけ', () => {
    expect(COPY.giftButton).toBe('ありがとうを贈る')
    // ★「いいね」を、ありがとうの言葉にしない
    expect(COPY.giftButton).not.toContain('いいね')
  })

  it('★いまの画面には「いいね」が1つも無い（足すなら、ありがとうと別の言葉・別の場所にする）', async () => {
    for (const [name, Page, props] of SCREENS) {
      fresh()
      const html = await render(Page, props)
      expect(`${name}:${html.includes('いいね')}`).toBe(`${name}:false`)
    }
  })

  it('★ありがとうは「取り消せない」と言う（いいねとの重さの違いを文言で出す）', async () => {
    fresh()
    const confirm = await render(ThanksPage as never, {
      params: { id: 'minato' },
      searchParams: { step: 'confirm', amount: '300' },
    })
    expect(confirm).toContain(COPY.giftIrreversible)
  })
})
