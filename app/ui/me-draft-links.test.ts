import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import MePage from './me/page'
import PublishPage from './drafts/[id]/publish/page'
import DraftMaterialsPage from './drafts/[id]/materials/page'
import AskPage from './songs/[id]/grow/ask/page'
import { createSampleSource, setUiDataSource, type UiDataSource } from '@/lib/ui-data'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'

// 自分の画面（I）の「下書き」の行から、公開する前の確認（G）・素材と元の歌（④）・
// 使わせてとお願いする（J）へ進めるようにした便。
// ★設計書・試作に「下書きの行から進む」道の指定は無い（最小の形）。
// ★進める先は、当てはまる物だけ出す（読み口が決める。画面で固定しない）。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})
const fresh = (edit?: (d: SampleData) => void): UiDataSource => {
  const data = clone()
  edit?.(data)
  const src = createSampleSource(data)
  restore = setUiDataSource(src)
  return src
}

// ── 下書きの行から進める ─────────────────────────────────

describe('自分の画面の「下書き」の行から進める', () => {
  it('主催が自分の下書きが並び、3つの進める先が出る', async () => {
    fresh()
    const html = await render(MePage)
    expect(html).toContain('data-draft="sodate"')
    expect(html).toContain('「港の灯り」から育てた歌')
    expect(html).toContain('まだ誰にも公開されていません')
    expect(html).toContain('href="/ui/drafts/sodate/publish"')
    expect(html).toContain('href="/ui/drafts/sodate/materials"')
    expect(html).toContain('/ui/songs/minato/grow/ask?take=c-melody')
    for (const label of ['公開する前の確認', '素材と元の歌', '使わせてとお願いする']) {
      expect(html, label).toContain(label)
    }
  })

  it('進んだ先の画面が、そのまま開ける', async () => {
    fresh()
    const publish = await render(PublishPage, { params: { id: 'sodate' }, searchParams: {} })
    expect(publish).toContain('「「港の灯り」から育てた歌」公開する前の確認')
    const materials = await render(DraftMaterialsPage, { params: { id: 'sodate' }, searchParams: {} })
    expect(materials).toContain('育てた歌_1.wav')
    const ask = await render(AskPage, { params: { id: 'minato' }, searchParams: { take: 'c-melody' } })
    expect(ask).toContain('data-screen="ask"')
    expect(ask).toContain('あさひさんの曲')
  })

  it('ほかの人が主催の下書きは、自分の画面に出さない', async () => {
    const src = fresh()
    const me = await src.getMe()
    // 見本には うみ が主催の下書きが3つある（雨のあとで・晴れの日に・星のかけら）
    expect(me.drafts.map((d) => d.id)).toEqual(['sodate'])
    const html = await render(MePage)
    // ★下書きの行として出ないこと（「雨のあとで」は自分の貢献の段に出るので、行の印で見る）
    expect(html).not.toContain('data-draft="ame"')
    expect(html).not.toContain('data-draft="hare"')
    expect(html).not.toContain('data-draft="hoshi"')
    expect(html).not.toContain('星のかけら')
  })
})

// ── 当てはまる物だけ出す ─────────────────────────────────

describe('進める先は、当てはまる物だけ出す', () => {
  it('素材を使っていない下書きには、素材と元の歌を出さない', async () => {
    const src = fresh((d) => {
      const v = d.versions.find((x) => x.id === 'v-sodate')
      ;(v as { materialIds: string[] }).materialIds = []
    })
    expect((await src.getMe()).drafts[0].materialsHref).toBeNull()
    const html = await render(MePage)
    expect(html).not.toContain('href="/ui/drafts/sodate/materials"')
    expect(html).toContain('href="/ui/drafts/sodate/publish"')
  })

  it('承認が必要な物を受け継いでいない下書きには、お願いの道を出さない', async () => {
    const src = fresh((d) => {
      // あさひさんの曲を「自由に使えます」に変える（可否は effectiveMode の結果）
      const p = d.reusePolicies.find((x) => x.contributionId === 'c-melody')
      ;(p as { mode: string }).mode = 'free'
    })
    expect((await src.getMe()).drafts[0].askHref).toBeNull()
    const html = await render(MePage)
    expect(html).not.toContain('grow/ask')
    expect(html).toContain('href="/ui/drafts/sodate/publish"')
  })

  it('公開してしまった下書きは、もう自分の画面に出さない', async () => {
    const src = fresh((d) => {
      const v = d.versions.find((x) => x.id === 'v-sodate')
      ;(v as { publishedAt: string | null }).publishedAt = '2026-09-19T00:00:00Z'
    })
    expect((await src.getMe()).drafts).toEqual([])
  })
})

// ── 下書きが無いとき ────────────────────────────────────

describe('下書きが無いとき（設計書 §3 I 空）', () => {
  it('「まだ下書きはありません。」を出し、進める先も出さない', async () => {
    fresh((d) => {
      d.publishDrafts = []
    })
    const html = await render(MePage)
    expect(html).toContain('まだ下書きはありません。')
    expect(html).not.toContain('data-draft=')
    expect(html).not.toContain('公開する前の確認')
    expect(html).not.toContain('grow/ask')
  })
})

// 押しやすさ（44px 以上）は、既存の押しやすさの試験が「自分」の画面ごと見ている
// （app/ui/tap-target.test.ts の SCREENS に「自分」がある）。ここでは重ねて見ない。

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('下書きを主催で絞らないと、ほかの人の下書きまで自分の画面に出る', async () => {
    const src = fresh()
    const mine = (await src.getMe()).drafts.map((d) => d.id)
    const OLD_ALL = SAMPLE.publishDrafts.map((d) => d.id)
    expect(mine).toEqual(['sodate']) // いま＝主催が自分の物だけ
    expect(OLD_ALL.length).toBeGreaterThan(1)
    expect(mine).not.toEqual(OLD_ALL) // 絞らなければ、ほかの人の下書きも出てしまう
  })

  it('進める先を固定にすると、当てはまらない下書きにも道が出てしまう', async () => {
    const src = fresh((d) => {
      const v = d.versions.find((x) => x.id === 'v-sodate')
      ;(v as { materialIds: string[] }).materialIds = []
    })
    const shown = (await src.getMe()).drafts[0].materialsHref
    const OLD_FIXED = '/ui/drafts/sodate/materials'
    expect(shown).toBeNull() // いま＝素材があるときだけ
    expect(OLD_FIXED).not.toBe(shown) // 固定なら、素材が無くても出てしまう
  })
})
