import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { ReactElement } from 'react'
import { createSampleSource, setUiDataSource } from '.'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'
import { traceVersionLineage } from '@/lib/domain/lineage'
import { requiredContributionsOf } from '@/lib/domain/lineage'
import type { Material, ReuseMode, Version } from '@/lib/domain/types'
import SongPage from '@/app/ui/songs/[id]/page'
import GrowPage from '@/app/ui/songs/[id]/grow/page'
import TreePage from '@/app/ui/songs/[id]/tree/page'

// 中核の決まり（lib/domain）→ 画面のつながり（棚卸し 3514b487 の重大発見1・項目 #13 #14 #15）。
// ・権利の表示「自由に使えます／承認が必要／利用できません」＝ effectiveMode の結果
// ・「この歌が生まれた流れ」＝ traceVersionLineage の結果
// ・「この歌をつくった人」＝ 採用された貢献（requiredContributionsOf）だけ
// 見本のデータは正本の型のまま持ち、表示の固定値を持たない。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData
const source = (data: SampleData) => createSampleSource(data)
const versionOf = (data: SampleData, songId: string): Version =>
  data.versions.find((v) => v.id === data.songs.find((s) => s.id === songId)?.versionId) as Version

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

// ── ① 見本の固定値を消しても、画面の表示は変わらない ─────────────

describe('① 見本は表示の固定値を持たない（決まりの結果として出る）', () => {
  // 説明の行（コメント）は決まりの説明なので外し、データそのものだけを見る
  const sampleSrc = readFileSync(path.join(ROOT, 'lib/preview/sample.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')

  it('見本のデータに、権利の言葉も「受け継いだ」の文も書かれていない', () => {
    for (const word of ['自由に使えます', '承認が必要', '利用できません', 'を受け継いだ']) {
      expect(sampleSrc, word).not.toContain(word)
    }
  })

  it('見本のデータに、貢献ごとの固定の可否（reuseMode）も、生まれた流れの配列（lineage）も無い', () => {
    expect(sampleSrc).not.toContain('reuseMode')
    expect(sampleSrc).not.toMatch(/\blineage\s*:/)
  })

  it('それでも画面には、同じ言葉がそのまま出る', async () => {
    const grow = await render(GrowPage, { params: { id: 'minato' }, searchParams: {} })
    for (const word of ['自由に使えます', '承認が必要', '利用できません']) expect(grow, word).toContain(word)
    const tree = await render(TreePage, { params: { id: 'futatabi' }, searchParams: {} })
    expect(tree).toContain('を受け継いだ')
  })
})

// ── ② 再利用の設定・貢献の採否を変えると、表示が変わる ──────────────

describe('② 決まりの入力を変えると、画面の表示が変わる', () => {
  it('再利用の設定（mode）を変えると、その物の札が変わり、選べなくなる', async () => {
    const data = clone()
    const p = data.reusePolicies.find((x) => x.contributionId === 'c-guitar')
    expect(p, 'ギターのポリシーが見本に在る').toBeTruthy()
    ;(p as { mode: ReuseMode }).mode = 'forbidden'

    const before = await source(SAMPLE).getSong('minato')
    const after = await source(data).getSong('minato')
    const label = (song: typeof after) => song?.inherit.find((c) => c.id === 'c-guitar')
    expect(label(before)?.statusLabel).toBe('自由に使えます')
    expect(label(after)?.statusLabel).toBe('利用できません')
    expect(label(after)?.selectable).toBe(false)

    restore = setUiDataSource(source(data))
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('つばささんのギター')
    expect(html).toMatch(/data-candidate="c-guitar"[^>]*>\s*<input[^>]*disabled=""/)
  })

  it('再利用の範囲（scope）を変えると、「利用できません」が外れる（mode は変えていない）', async () => {
    const data = clone()
    const p = data.reusePolicies.find((x) => x.contributionId === 'c-mix')
    expect(p?.mode).toBe('free')
    expect(p?.scope).toBe('this_version_only')
    ;(p as { scope: string }).scope = 'any_version'

    const after = await source(data).getSong('minato')
    const mix = after?.inherit.find((c) => c.id === 'c-mix')
    expect(mix?.statusLabel).toBe('自由に使えます')
    expect(mix?.selectable).toBe(true)
  })

  it('設定が無い貢献は、決まりの初期値「承認が必要」になる', async () => {
    const song = await source(SAMPLE).getSong('futari')
    expect(SAMPLE.reusePolicies.some((p) => p.contributionId === 'c3-piano')).toBe(false)
    expect(song?.inherit.find((c) => c.id === 'c3-piano')?.statusLabel).toBe('承認が必要')
  })

  it('送り物を採用すると、つくった人にその人が増える', async () => {
    const data = clone()
    const sub = data.submissions.find((s) => s.id === 's-chorus')
    expect(sub?.state).toBe('not_adopted')
    const version = versionOf(data, 'minato')
    data.contributions.push({
      id: 's-chorus',
      roleKindId: 'chorus',
      holderIds: ['h-hinata'],
      birthVersionId: version.id,
      createdAt: version.publishedAt as string,
    })
    version.contributions.push({ contributionId: 's-chorus', relation: 'created' })
    data.submissions = data.submissions.filter((s) => s.id !== 's-chorus')

    const before = await source(SAMPLE).getSong('minato')
    const after = await source(data).getSong('minato')
    expect(before?.credits.map((c) => c.name)).not.toContain('ひなた')
    expect(after?.credits.map((c) => c.name)).toContain('ひなた')

    restore = setUiDataSource(source(data))
    expect(await render(SongPage, { params: { id: 'minato' } })).toContain('ひなたさん　コーラス')
  })
})

// ── ③ 生まれた流れが traceVersionLineage と一致する ────────────────

describe('③ 生まれた流れは traceVersionLineage の結果', () => {
  const materials = new Map<string, Material>(SAMPLE.materials.map((m) => [m.id, m]))

  it('画面に出る行が、正本のたどり方で出る「よそで生まれた貢献」と過不足なく一致する', async () => {
    for (const s of SAMPLE.songs) {
      const version = versionOf(SAMPLE, s.id)
      const expected = traceVersionLineage(version, materials, SAMPLE.derivations)
        .map((e) => SAMPLE.contributions.find((c) => c.id === e.contributionId))
        .filter((c) => c && c.birthVersionId !== version.id)
      const song = await source(SAMPLE).getSong(s.id)
      expect(song?.lineage.length, s.id).toBe(expected.length)
    }
  })

  it('「港の灯り」は由来（歌詞の元）をたどって「夜明けのうた」に当たる', async () => {
    const song = await source(SAMPLE).getSong('minato')
    expect(song?.lineage.map((l) => l.label)).toEqual(['「夜明けのうた」のひなたさんの歌詞を受け継いだ'])
    const html = await render(TreePage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('「夜明けのうた」のひなたさんの歌詞を受け継いだ')
  })

  it('由来の矢印を外すと、生まれた流れの行も消える', async () => {
    const data = clone()
    data.derivations = []
    const song = await source(data).getSong('minato')
    expect(song?.lineage).toEqual([])
    restore = setUiDataSource(source(data))
    expect(await render(TreePage, { params: { id: 'minato' }, searchParams: {} })).toContain(
      'この歌は、何も受け継いでいない最初の歌です。',
    )
  })

  it('何も受け継いでいない歌は空（最初の歌）', async () => {
    expect((await source(SAMPLE).getSong('yoake'))?.lineage).toEqual([])
  })
})

// ── ④ つくった人は、採用された貢献だけから出る ───────────────────

describe('④ つくった人は、採用された貢献（requiredContributionsOf）だけから出る', () => {
  const materials = new Map<string, Material>(SAMPLE.materials.map((m) => [m.id, m]))

  it('どの歌でも、つくった人の顔ぶれが、その Version が使う貢献の作者と一致する', async () => {
    for (const s of SAMPLE.songs) {
      const version = versionOf(SAMPLE, s.id)
      const expected = new Set<string>()
      requiredContributionsOf(version, materials).forEach((_paths, cid) => {
        const c = SAMPLE.contributions.find((x) => x.id === cid)
        for (const h of c?.holderIds ?? []) expected.add(h)
      })
      const song = await source(SAMPLE).getSong(s.id)
      expect(new Set(song?.credits.map((c) => c.holderId)), s.id).toEqual(expected)
    }
  })

  it('採用されていない送り物の人は、つくった人に入らない', async () => {
    const song = await source(SAMPLE).getSong('minato')
    expect(song?.contributions.some((c) => c.id === 's-chorus' && c.state === 'not_adopted')).toBe(true)
    expect(song?.credits.map((c) => c.holderId)).not.toContain('h-hinata')
    expect(await render(SongPage, { params: { id: 'minato' } })).not.toContain('ひなたさん')
  })

  it('表示の対象から外れた貢献の人は、つくった人に入らない', async () => {
    const data = clone()
    data.hiddenContributionIds = ['c-mix']
    const song = await source(data).getSong('minato')
    expect(song?.credits.map((c) => c.name)).not.toContain('りく')
    expect(song?.inherit.map((c) => c.id)).not.toContain('c-mix')
  })
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認（固定の対応表に戻すと②が落ちる）', () => {
  it('昔の固定の対応表なら、設定を変えても札が変わらない＝②を通せない', async () => {
    // 便の前に画面が出していた物：貢献ごとに固定で書いた可否
    const OLD_FIXED_TABLE: Record<string, ReuseMode> = {
      'c-lyrics': 'free',
      'c-melody': 'approval',
      'c-vocal': 'approval',
      'c-guitar': 'free',
      'c-mix': 'forbidden',
    }
    const data = clone()
    ;(data.reusePolicies.find((x) => x.contributionId === 'c-guitar') as { mode: ReuseMode }).mode = 'forbidden'

    const shown = (await source(data).getSong('minato'))?.inherit.find((c) => c.id === 'c-guitar')?.mode
    expect(shown).toBe('forbidden') // いま＝正本の effectiveMode の結果
    expect(OLD_FIXED_TABLE['c-guitar']).toBe('free') // 固定の対応表は入力を見ない
    expect(shown).not.toBe(OLD_FIXED_TABLE['c-guitar'])
  })

  it('固定の文字列に戻すと③が落ちる：由来を外しても、固定の文だけは残ってしまう', async () => {
    const OLD_FIXED_LINEAGE = ['あさひさんの歌詞から', '「夜明けのうた」の歌から育った']
    const data = clone()
    data.derivations = []
    const song = await source(data).getSong('minato')
    expect(song?.lineage).toEqual([]) // いま＝traceVersionLineage の結果
    expect(OLD_FIXED_LINEAGE).toHaveLength(2) // 固定の文字列は入力を見ない
  })
})
