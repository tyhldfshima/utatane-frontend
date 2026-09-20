import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import DraftMaterialsPage from './drafts/[id]/materials/page'
import PublishPage from './drafts/[id]/publish/page'
import { FROM_UTATANE, KIND_REQUIRED_REASON, SOURCE_REQUIRED_REASON } from './drafts/[id]/materials/ProvenanceForm'
import { createSampleSource, setUiDataSource, type UiDataSource } from '@/lib/ui-data'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'

// ④ 素材と元の歌：出どころの申告（設計書 utatane-core-db-api-v1.md:60・:154）。
// ・申告が無い素材は公開の再検証（checkMaterials）で止まる／申告すると通る
// ・止まる理由も「済んだか」も lib/domain の結果から来る（画面では判断しない）
// ・★本物の保存は PR #4〜#6 待ち。申告は見本の読み口の中にだけ残る

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
const screen = (id: string, searchParams: Record<string, string> = {}) => ({ params: { id }, searchParams })
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

/** 見本を書き換えないよう、試験ごとに新しい読み口を立てる */
const fresh = (): UiDataSource => {
  const src = createSampleSource(clone())
  restore = setUiDataSource(src)
  return src
}

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

// ── 申告の項目（checkMaterials が求める物） ────────────────────

describe('申告の項目は、決まりが求める物と同じ', () => {
  it('出どころの種類は、設計書の6つがデータから来る（画面で固定していない）', async () => {
    const v = await fresh().getDraftMaterials('hoshi')
    expect(v?.kinds.map((k) => k.id)).toEqual([
      'self_made',
      'co_made',
      'licensed',
      'from_utatane_material',
      'external_material',
      'includes_ai',
    ])
    expect(v?.kinds.map((k) => k.label)).toEqual([
      '自作',
      '共同制作',
      '許諾済み',
      'UTATANE 内の素材から',
      '外部の素材',
      'AI を含む',
    ])
  })

  it('「UTATANE 内の素材から」のときだけ、元の素材を選ぶ', async () => {
    const src = fresh()
    const list = await render(DraftMaterialsPage, screen('hoshi'))
    expect(list).toContain('出どころを申告する')
    const form = await render(DraftMaterialsPage, screen('hoshi', { material: 'm-hoshi' }))
    expect(form).toContain('data-screen="provenance"')
    expect(form).toContain('data-kind-option="self_made"')
    expect(form).toContain('data-kind-option="from_utatane_material"')
    // 種類を選ぶ前は、元の素材の欄は出さない（画面は選んだ種類で出し分ける）
    expect(form).not.toContain('data-part="source"')
    expect(KIND_REQUIRED_REASON).toBe('出どころを1つ選んでください。')
    expect(SOURCE_REQUIRED_REASON).toBe('元の素材を選んでください。')
    expect(FROM_UTATANE).toBe('from_utatane_material')
    // その下書きが使っていない素材が、元にできる候補
    expect((await src.getDraftMaterials('hoshi'))?.sourceOptions.map((o) => o.id)).toEqual([
      'm-ame',
      'm-hare',
      'm-sodate',
    ])
  })
})

// ── 申告が無いと止まる／申告すると通る ─────────────────────────

describe('申告が無い素材は公開の再検証で止まり、申告すると通る', () => {
  it('申告が無いと ④ が「済」にならず、公開に進めない', async () => {
    const src = fresh()
    const v = await src.getDraftMaterials('hoshi')
    expect(v?.done).toBe(false)
    expect(v?.materials[0].declaredLabel).toBeNull()
    expect(v?.materials[0].issue).toBe('出どころが申告されていません。')

    const publish = await src.getPublish('hoshi')
    expect(publish?.ready).toBe(false)
    expect(publish?.steps.find((s) => s.key === 'materials')?.done).toBe(false)
    expect(publish?.blockedReasons).toEqual(['④ 素材と元の歌 がまだ済んでいません。'])
    // ★同意はそろっている（止まっているのは素材だけ）
    expect(publish?.consents.every((c) => c.done)).toBe(true)
  })

  it('申告すると ④ が「済」になり、公開に進める', async () => {
    const src = fresh()
    const after = await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: 'self_made' })
    expect(after?.done).toBe(true)
    expect(after?.materials[0].declaredLabel).toBe('自作')
    expect(after?.materials[0].issue).toBeNull()

    const publish = await src.getPublish('hoshi')
    expect(publish?.ready).toBe(true)
    expect(publish?.steps.find((s) => s.key === 'materials')?.done).toBe(true)
    expect(publish?.blockedReasons).toEqual([])
  })

  it('画面から申告すると、一覧に「出どころを申告しました」が出て、公開する前の確認へ進める', async () => {
    fresh()
    const before = await render(DraftMaterialsPage, screen('hoshi'))
    expect(before).toContain('data-done="false"')
    expect(before).toContain('出どころが申告されていません。')
    expect(count(before, 'data-ui="primary"')).toBe(0)

    const after = await render(DraftMaterialsPage, screen('hoshi', { material: 'm-hoshi', kind: 'self_made' }))
    expect(after).toContain('data-part="declared"')
    expect(after).toContain('出どころを申告しました')
    expect(after).toContain('data-done="true"')
    expect(after).toContain('申告済み')
    expect(count(after, 'data-ui="primary"')).toBe(1)
    expect(after).toContain('href="/ui/drafts/hoshi/publish"')
  })

  it('画面から申告した結果が、公開する前の確認（G）にも効く', async () => {
    fresh()
    const blocked = await render(PublishPage, screen('hoshi'))
    expect(blocked).toContain('④ 素材と元の歌 がまだ済んでいません。')
    expect(blocked).toContain('href="/ui/drafts/hoshi/materials"')
    expect(count(blocked, 'data-ui="primary"')).toBe(0)

    await render(DraftMaterialsPage, screen('hoshi', { material: 'm-hoshi', kind: 'self_made' }))

    const ok = await render(PublishPage, screen('hoshi'))
    expect(ok).toContain('④ 素材と元の歌 済')
    expect(ok).not.toContain('④ 素材と元の歌 がまだ済んでいません。')
    expect(ok).not.toContain('素材の出どころを申告する')
    expect(count(ok, 'data-ui="primary"')).toBe(1)
  })
})

// ── UTATANE 内の素材から（元の貢献を全部収めていること） ──────────

describe('「UTATANE 内の素材から」は、元の素材の貢献を全部収めていないと通らない', () => {
  it('元の素材を選んでも、その貢献を収めていなければ止まったまま', async () => {
    const src = fresh()
    const after = await src.declareProvenance({
      draftId: 'hoshi',
      materialId: 'm-hoshi',
      kind: 'from_utatane_material',
      sourceMaterialId: 'm-ame',
    })
    expect(after?.materials[0].declaredLabel).toBe('UTATANE 内の素材から')
    expect(after?.materials[0].sourceLabel).toBe('雨のあとで_1.wav')
    expect(after?.done).toBe(false)
    expect(after?.materials[0].issue).toBe('元の素材が収めている貢献を、すべて収めていません。')
    expect((await src.getPublish('hoshi'))?.ready).toBe(false)
  })

  it('元の素材が見つからないときは、その理由が出る', async () => {
    const src = fresh()
    const after = await src.declareProvenance({
      draftId: 'hoshi',
      materialId: 'm-hoshi',
      kind: 'from_utatane_material',
      sourceMaterialId: '無い素材',
    })
    expect(after?.materials[0].issue).toBe('元の素材が見つかりません。')
    expect(after?.done).toBe(false)
  })

  it('元の素材の貢献を全部収めていれば通る', async () => {
    const data = clone()
    const hoshi = data.materials.find((m) => m.id === 'm-hoshi')
    const ame = data.materials.find((m) => m.id === 'm-ame')
    ;(hoshi as { embodiedContributionIds: string[] }).embodiedContributionIds = [
      ...(hoshi?.embodiedContributionIds ?? []),
      ...(ame?.embodiedContributionIds ?? []),
    ]
    const src = createSampleSource(data)
    restore = setUiDataSource(src)
    const after = await src.declareProvenance({
      draftId: 'hoshi',
      materialId: 'm-hoshi',
      kind: 'from_utatane_material',
      sourceMaterialId: 'm-ame',
    })
    expect(after?.done).toBe(true)
    expect(after?.materials[0].issue).toBeNull()
  })
})

// ── 受け付けない物・仮の形 ───────────────────────────────────

describe('受け付けない物と、仮の形であること', () => {
  it('無い下書き・無い素材・無い種類は申告できない', async () => {
    const src = fresh()
    expect(await src.declareProvenance({ draftId: '無い下書き', materialId: 'm-hoshi', kind: 'self_made' })).toBeNull()
    expect(await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-ame', kind: 'self_made' })).toBeNull()
    expect(await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: '無い種類' })).toBeNull()
    expect((await src.getDraftMaterials('hoshi'))?.done).toBe(false)
  })

  it('公開済みの Version の素材は、申告の画面に出さない', async () => {
    const data = clone()
    const draft = data.publishDrafts.find((d) => d.id === 'hoshi')
    ;(draft as { versionId: string }).versionId = 'v-minato'
    const src = createSampleSource(data)
    expect(await src.getDraftMaterials('hoshi')).toBeNull()
    expect(await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: 'self_made' })).toBeNull()
  })

  it('無い下書きの画面は 404', async () => {
    fresh()
    await expect(render(DraftMaterialsPage, screen('無い下書き'))).rejects.toThrow()
  })

  it('★本物の保存はしない（申告の画面に仮の形と書いてある）', async () => {
    fresh()
    const form = await render(DraftMaterialsPage, screen('hoshi', { material: 'm-hoshi' }))
    expect(form).toContain('data-provisional="provenance-write"')
    expect(form).toContain('仮の形：申告は見本の中にだけ残ります。')
  })

  it('★申告しても、見本の正本（SAMPLE）は書き換わらない', async () => {
    const src = fresh()
    await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: 'self_made' })
    expect(SAMPLE.materials.find((m) => m.id === 'm-hoshi')?.provenance).toBeNull()
  })

  it('すでに申告済みの素材は、申告し直せる', async () => {
    const src = fresh()
    await src.declareProvenance({ draftId: 'hare', materialId: 'm-hare', kind: 'licensed' })
    const v = await src.getDraftMaterials('hare')
    expect(v?.materials[0].declaredLabel).toBe('許諾済み')
    expect(v?.done).toBe(true)
    const html = await render(DraftMaterialsPage, screen('hare'))
    expect(html).toContain('申告し直す')
  })
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('申告の保存をやめると、①申告しても ④ が済まない＝試験を通せない', async () => {
    const src = fresh()
    // 「保存しない読み口」＝申告を受け取っても見本を変えない（便の前の形）
    const noSave = { ...src, declareProvenance: async () => src.getDraftMaterials('hoshi') } as UiDataSource
    const after = await noSave.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: 'self_made' })
    expect(after?.done).toBe(false) // 保存しなければ ④ は済まない
    const real = await src.declareProvenance({ draftId: 'hoshi', materialId: 'm-hoshi', kind: 'self_made' })
    expect(real?.done).toBe(true) // いま＝保存する
  })

  it('止まる理由を固定の文字列にすると、元の素材の食い違いを見分けられない', async () => {
    const OLD_FIXED = '出どころが申告されていません。'
    const src = fresh()
    const after = await src.declareProvenance({
      draftId: 'hoshi',
      materialId: 'm-hoshi',
      kind: 'from_utatane_material',
      sourceMaterialId: 'm-ame',
    })
    const shown = after?.materials[0].issue
    expect(shown).toBe('元の素材が収めている貢献を、すべて収めていません。') // いま＝checkMaterials の理由
    expect(shown).not.toBe(OLD_FIXED)
  })
})
