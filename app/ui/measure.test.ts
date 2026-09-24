import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { ReactElement } from 'react'
import JoinPage from './songs/[id]/join/page'
import ThanksPage from './songs/[id]/thanks/page'
import PublishPage from './drafts/[id]/publish/page'
import DraftPage from './drafts/[id]/page'
import {
  LOOP_STAGES,
  LOOP_STAGE_LABEL,
  measure,
  noopSink,
  setMeasureSink,
  type LoopStage,
} from '@/lib/measure'

// 計測の「形だけ」（正本 docs/design/utatane-completion-criteria.md §4・対応表は
// docs/design/utatane-measure-shape.md）。
//
// ★えふさん確定：「正本 §4 のループ8段を、送り先を決めない送り口で画面の操作点に置く
//  （名前・基盤・保存期間は固定しない）。」
//
// この試験が見張る物は4つ：
//   1. 8段と対応表が、正本 §4 とずれていない
//   2. 画面が在る段は、操作したときに送り口が**1回だけ**鳴る（操作していない状態では鳴らない）
//   3. 送り口は**外へ何も送らない**（既定は何もしない形）
//   4. 送り口を置いても、画面の**見た目・動き**が変わらない

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}

/** 鳴った段を控えるだけの送り口（試験用）。★これも外へは何も送らない。 */
const recorder = () => {
  const marks: LoopStage[] = []
  return { marks, sink: { mark: (s: LoopStage) => void marks.push(s) } }
}

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
  vi.unstubAllGlobals()
})

/** 画面を描いて、その間に鳴った段を返す */
const marksOf = async (C: (props: never) => unknown, props: Record<string, unknown>) => {
  const { marks, sink } = recorder()
  restore = setMeasureSink(sink)
  await render(C, props)
  restore()
  restore = null
  return marks
}

// 画面の操作点（正本 §4 の段 → 画面と、その操作を終えた住所）
const JOIN_SONG = 'minato'
const joined = (q: Record<string, string>) => ({ params: { id: JOIN_SONG }, searchParams: q })

const OPERATIONS: { stage: LoopStage; name: string; page: (props: never) => unknown; props: Record<string, unknown> }[] = [
  { stage: 'M-2', name: '参加：何で参加するかが決まった', page: JoinPage, props: joined({ step: 'submit', role: 'guitar' }) },
  { stage: 'M-3', name: '参加：送った', page: JoinPage, props: joined({ step: 'sent', role: 'guitar' }) },
  { stage: 'M-6', name: '公開：公開した', page: PublishPage, props: { params: { id: 'hare' }, searchParams: { done: '1' } } },
  { stage: 'M-7', name: 'TYP：ありがとうが届いた', page: ThanksPage, props: { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300' } } },
  {
    stage: 'M-8',
    name: '次の創作：受け継いだ下書きができた',
    page: DraftPage,
    props: { params: { id: 'new' }, searchParams: { from: 'minato', take: 'c-lyrics', add: 'vocal' } },
  },
]

// 操作していない状態（＝鳴ってはいけない住所）
const NOT_OPERATIONS: { name: string; page: (props: never) => unknown; props: Record<string, unknown> }[] = [
  { name: '参加：何で参加するかを選ぶ前', page: JoinPage, props: joined({}) },
  { name: '参加：送っています', page: JoinPage, props: joined({ step: 'submit', role: 'guitar', state: 'sending' }) },
  { name: '参加：送れませんでした', page: JoinPage, props: joined({ step: 'submit', role: 'guitar', state: 'error' }) },
  { name: '公開：同意を待っている', page: PublishPage, props: { params: { id: 'ame' }, searchParams: {} } },
  { name: '公開：同意がそろった（まだ押していない）', page: PublishPage, props: { params: { id: 'hare' }, searchParams: {} } },
  { name: '公開：確認の小窓', page: PublishPage, props: { params: { id: 'hare' }, searchParams: { confirm: '1' } } },
  { name: '公開：公開できませんでした', page: PublishPage, props: { params: { id: 'hare' }, searchParams: { state: 'error' } } },
  { name: 'TYP：量を選ぶ', page: ThanksPage, props: { params: { id: 'minato' }, searchParams: { amount: '300' } } },
  { name: 'TYP：贈る前の確認', page: ThanksPage, props: { params: { id: 'minato' }, searchParams: { step: 'confirm', amount: '300' } } },
  {
    name: 'TYP：贈れませんでした',
    page: ThanksPage,
    props: { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300', r: 'failed' } },
  },
  {
    name: 'TYP：結果を確認しています',
    page: ThanksPage,
    props: { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300', r: 'checking' } },
  },
  {
    name: '次の創作：受け継ぐ物が選ばれていない',
    page: DraftPage,
    props: { params: { id: 'new' }, searchParams: { from: 'minato', take: '' } },
  },
]

// ── 1. 8段と対応表が、正本 §4 とずれていない ─────────────────────

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const rows = (text: string) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))

describe('8段は、正本 §4 の表そのまま', () => {
  const doc = read('docs/design/utatane-completion-criteria.md')
  const stageRows = rows(doc).filter((r) => /^M-\d+$/.test(r[0]))

  it('番号も並びも、正本 §4 の M-1〜M-8 と同じ', () => {
    expect(stageRows.map((r) => r[0])).toEqual([...LOOP_STAGES])
  })

  it('段の呼び名も、正本 §4 の「段」欄と同じ', () => {
    expect(stageRows.map((r) => r[1])).toEqual(LOOP_STAGES.map((s) => LOOP_STAGE_LABEL[s]))
  })

  it('★イベント名は1つも持ち込んでいない（名前は固定しない＝正本 §4）', () => {
    const src = read('lib/measure/port.ts') + read('lib/measure/index.ts')
    for (const name of stageRows.map((r) => r[2].replace(/`/g, ''))) {
      expect(`${name}:${src.includes(name)}`).toBe(`${name}:false`)
    }
  })
})

describe('対応表（8段 × 画面の有無）が、実物とそろっている', () => {
  const table = rows(read('docs/design/utatane-measure-shape.md')).filter((r) => /^M-\d+$/.test(r[0]))

  it('8段ぶん、正本と同じ番号で並ぶ', () => {
    expect(table.map((r) => r[0])).toEqual([...LOOP_STAGES])
  })

  it('「画面あり」と書いた段だけ、この試験が操作点を持っている', () => {
    const withScreen = table.filter((r) => r[2] === 'あり').map((r) => r[0])
    expect(OPERATIONS.map((o) => o.stage)).toEqual(withScreen)
  })

  it('「まだ画面が無い」段は、どの画面からも鳴らさない', () => {
    const without = table.filter((r) => r[2] !== 'あり').map((r) => r[0])
    expect(without).toEqual(['M-1', 'M-4', 'M-5'])
    const src = ['app/ui/songs/[id]/join/page.tsx', 'app/ui/songs/[id]/thanks/page.tsx', 'app/ui/drafts/[id]/page.tsx', 'app/ui/drafts/[id]/publish/page.tsx']
      .map(read)
      .join('\n')
    for (const stage of without) expect(`${stage}:${src.includes(`mark('${stage}')`)}`).toBe(`${stage}:false`)
  })
})

// ── 2. 操作したときに、1回だけ鳴る ──────────────────────────────

describe('画面が在る段は、操作したときに送り口が1回だけ呼ばれる', () => {
  for (const op of OPERATIONS) {
    it(`${op.stage}（${op.name}）で、${op.stage} がちょうど1回`, async () => {
      expect(await marksOf(op.page, op.props)).toEqual([op.stage])
    })
  }
})

describe('操作していない状態では、1回も呼ばれない', () => {
  for (const s of NOT_OPERATIONS) {
    it(`${s.name}`, async () => {
      expect(await marksOf(s.page, s.props)).toEqual([])
    })
  }
})

// ── 3. 送り口は外へ何も送らない ────────────────────────────────

describe('送り口は外へ何も送らない', () => {
  it('既定の送り口は「何もしない形」で、戻り値も持たない', () => {
    expect(measure()).toBe(noopSink)
    for (const stage of LOOP_STAGES) expect(noopSink.mark(stage)).toBeUndefined()
  })

  it('★実測：既定のまま操作点を全部描いても、通信は1回も起きない', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(measure()).toBe(noopSink) // 差し替えていない＝本番と同じ形
    for (const op of OPERATIONS) await render(op.page, op.props)
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it('差し替えても戻せる（送り先は画面の外で決める）', () => {
    const { sink } = recorder()
    const undo = setMeasureSink(sink)
    expect(measure()).toBe(sink)
    undo()
    expect(measure()).toBe(noopSink)
  })
})

// ── 4. 画面の見た目・動きが変わらない ──────────────────────────

describe('送り口を置いても、画面の見た目・動きは変わらない', () => {
  for (const op of [...OPERATIONS, ...NOT_OPERATIONS]) {
    const label = 'stage' in op ? `${op.stage}（${op.name}）` : op.name
    it(`${label}：鳴る送り口でも、何もしない送り口でも、出来上がりが同じ`, async () => {
      const quiet = await render(op.page, op.props)
      const { sink } = recorder()
      restore = setMeasureSink(sink)
      const loud = await render(op.page, op.props)
      expect(loud).toBe(quiet)
    })
  }
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('「画面を開いたら必ず鳴らす」にすると、操作していない状態でも鳴る＝上の試験を通せない', async () => {
    // いま＝操作した住所でだけ鳴る
    expect(await marksOf(PublishPage, { params: { id: 'hare' }, searchParams: { done: '1' } })).toEqual(['M-6'])
    // 同じ画面・同じ歌でも、操作していない住所では鳴らない
    expect(await marksOf(PublishPage, { params: { id: 'hare' }, searchParams: {} })).toEqual([])
    expect(await marksOf(PublishPage, { params: { id: 'hare' }, searchParams: { confirm: '1' } })).toEqual([])
  })

  it('同意がそろっていないのに住所で ?done=1 を開いても鳴らない（完了にならないので）', async () => {
    expect(await marksOf(PublishPage, { params: { id: 'ame' }, searchParams: { done: '1' } })).toEqual([])
  })

  it('★通信の見張りが空振りしていない（同じ仕掛けで、呼べばちゃんと数える）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const op of OPERATIONS) await render(op.page, op.props)
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    ;(globalThis.fetch as unknown as () => void)()
    expect(fetchSpy).toHaveBeenCalledTimes(1) // 数える仕掛け自体は生きている
  })

  it('段の見張りが空振りしていない（呼び名を1つ変えた表は、正本とずれる）', () => {
    const broken = { ...LOOP_STAGE_LABEL, 'M-7': 'ポイント' }
    expect(LOOP_STAGES.map((s) => broken[s])).not.toEqual(LOOP_STAGES.map((s) => LOOP_STAGE_LABEL[s]))
  })
})
