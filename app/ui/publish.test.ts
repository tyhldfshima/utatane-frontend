import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import PublishPage from './drafts/[id]/publish/page'
import { COPY } from '@/components/ui'
import { createSampleSource, setUiDataSource } from '@/lib/ui-data'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'
import type { ReuseMode } from '@/lib/domain/types'

// G 公開する前の確認（主催が公開する）。設計書 utatane-focus-screens-spec.md:196-208・試作 g-normal〜g-done。
// ・5状態：通常（同意を待っている）／同意がそろった／確認の小窓／エラー／完了
// ・止まる理由とステップの「済」は、lib/domain の公開前の再検証の結果から出る（画面で決めない）
// ・取り返しのつかない操作（公開）の確認は1回だけ

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
const screen = (id: string, searchParams: Record<string, string> = {}) => ({ params: { id }, searchParams })
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData
const source = (data: SampleData) => createSampleSource(data)

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

// ── 5状態 ────────────────────────────────────────────────

describe('G の5状態（設計書 §3 G）', () => {
  it('通常（同意を待っている）：①〜⑤ に「済」・⑥ 必要な同意の行・待っている人の一文・押せない［公開する］', async () => {
    const html = await render(PublishPage, screen('ame'))
    expect(html).toContain('data-screen="publish"')
    expect(html).toContain('「雨のあとで」公開する前の確認')
    for (const step of ['① 音 済', '② クレジット 済', '③ 届け方 済', '④ 素材と元の歌 済', '⑤ 使ってもらう時の希望 済']) {
      expect(html, step).toContain(step)
    }
    expect(html).toContain('⑥ 同意と公開')
    expect(html).toContain('⑥ 必要な同意')
    // 主催（うみ）は自分の分なので並べない
    expect(html).not.toContain('うみさん')
    expect(html).toContain('そらさん')
    expect(html).toContain('みなとさん')
    expect(html).toContain(COPY.consentDone)
    expect(html).toContain(COPY.consentYet)
    expect(html).toContain('みなとさんの同意を待っています。')
    // 主ボタンは押せない（設計書：なし（押せない［公開する］））
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(html).toContain('data-ui="unavailable"')
    expect(html).toContain(COPY.publishButton)
  })

  it('同意がそろった：全員「同意済み」・主ボタン［公開する］が1つ・［もう一度お願いする］は出さない', async () => {
    const html = await render(PublishPage, screen('hare'))
    expect(html).toContain('data-ready="true"')
    expect(html).toContain('「晴れの日に」公開する前の確認')
    expect(count(html, COPY.consentDone)).toBe(3) // そら・あさひ・みなと
    expect(html).not.toContain(`>${COPY.consentYet}<`)
    expect(html).not.toContain(COPY.publishAskAgain)
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('href="/ui/drafts/hare/publish?confirm=1"')
  })

  it('確認の小窓：設計書の3つの文言が出て、主ボタンは小窓の中の1つだけ', async () => {
    const html = await render(PublishPage, screen('hare', { confirm: '1' }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain(COPY.publishConfirmTitle)
    expect(html).toContain(COPY.publishConfirmBody)
    expect(html).toContain(COPY.publishConfirmNote)
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('href="/ui/drafts/hare/publish?done=1"')
    expect(html).toContain('href="/ui/drafts/hare/publish"') // 戻る
  })

  it('エラー：「公開できませんでした。」「通信がつながりませんでした。まだ公開されていません。」と［もう一度］', async () => {
    const html = await render(PublishPage, screen('hare', { state: 'error' }))
    expect(html).toContain('data-screen="publish-error"')
    expect(html).toContain(COPY.publishErrorTitle)
    expect(html).toContain(COPY.publishErrorBody)
    expect(html).toContain('data-state="error"')
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain(COPY.retry)
  })

  it('完了：「公開しました」「誰でも聴けるようになりました。」と［公開した歌を見る］', async () => {
    const html = await render(PublishPage, screen('hare', { done: '1' }))
    expect(html).toContain('data-screen="publish-done"')
    expect(html).toContain(COPY.publishDoneTitle)
    expect(html).toContain(COPY.publishDoneBody)
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain(COPY.publishDoneButton)
    expect(html).toContain('href="/ui/songs/hare"')
  })
})

// ── 確認は1回だけ・取り返しのつかない操作の守り ───────────────────

describe('取り返しのつかない操作（公開）の守り', () => {
  it('確認の小窓は1回だけ：通常の画面では小窓を出さない', async () => {
    expect(await render(PublishPage, screen('hare'))).not.toContain('role="dialog"')
    expect(count(await render(PublishPage, screen('hare', { confirm: '1' })), 'role="dialog"')).toBe(1)
  })

  it('同意がそろっていないのに住所で小窓を開こうとしても、開かない', async () => {
    const html = await render(PublishPage, screen('ame', { confirm: '1' }))
    expect(html).not.toContain('role="dialog"')
    expect(html).toContain('data-screen="publish"')
  })

  it('同意がそろっていないのに住所で完了を開こうとしても、完了にしない', async () => {
    const html = await render(PublishPage, screen('ame', { done: '1' }))
    expect(html).not.toContain('data-screen="publish-done"')
    expect(html).not.toContain(COPY.publishDoneTitle)
    expect(html).toContain('data-screen="publish"')
  })

  it('★本物の公開の書き込みはしない（完了の画面に仮の形と書いてある）', async () => {
    const html = await render(PublishPage, screen('hare', { done: '1' }))
    expect(html).toContain('data-provisional="publish-write"')
    expect(html).toContain('仮の形：本物の公開はまだ行われません。')
  })

  it('無い下書きは 404（notFound が投げられる）', async () => {
    await expect(render(PublishPage, screen('無い下書き'))).rejects.toThrow()
  })
})

// ── 公開前の再検証（止まる場合と通る場合） ──────────────────────

describe('公開前の再検証（revalidateForPublish・checkMaterials）の結果が画面に出る', () => {
  it('許諾が足りないと止まり、成立していると通る', async () => {
    const ame = await source(SAMPLE).getPublish('ame')
    expect(ame?.ready).toBe(false)
    expect(ame?.blockedReasons).toEqual(['みなとさんの同意を待っています。'])
    const hare = await source(SAMPLE).getPublish('hare')
    expect(hare?.ready).toBe(true)
    expect(hare?.blockedReasons).toEqual([])
  })

  it('成立していた許諾を取り消すと、通っていた下書きが止まる', async () => {
    const data = clone()
    const p = data.permissions.find((x) => x.id === 'p-hare-vocal')
    expect(p, '「晴れの日に」の許諾が見本に在る').toBeTruthy()
    ;(p as { events: { kind: string; actorHolderId: string | null; at: string }[] }).events.push({
      kind: 'revoked',
      actorHolderId: 'h-minato',
      at: '2026-09-18T00:00:00Z',
    })
    const v = await source(data).getPublish('hare')
    expect(v?.ready).toBe(false)
    expect(v?.blockedReasons).toEqual(['みなとさんの同意を待っています。'])
    restore = setUiDataSource(source(data))
    const html = await render(PublishPage, screen('hare'))
    expect(html).toContain('みなとさんの同意を待っています。')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('素材の出どころの申告を消すと、④ 素材と元の歌 の「済」が外れて止まる', async () => {
    const data = clone()
    const m = data.materials.find((x) => x.id === 'm-hare')
    expect(m?.provenance).toBeTruthy()
    ;(m as { provenance: unknown }).provenance = null
    const v = await source(data).getPublish('hare')
    expect(v?.ready).toBe(false)
    expect(v?.steps.find((x) => x.key === 'materials')?.done).toBe(false)
    expect(v?.blockedReasons).toContain('④ 素材と元の歌 がまだ済んでいません。')
    restore = setUiDataSource(source(data))
    const html = await render(PublishPage, screen('hare'))
    expect(html).toContain('④ 素材と元の歌')
    expect(html).not.toContain('④ 素材と元の歌 済')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('再利用の設定を「利用できません」にすると、その物の理由で止まる', async () => {
    const data = clone()
    const p = data.reusePolicies.find((x) => x.contributionId === 'c-lyrics')
    ;(p as { mode: ReuseMode }).mode = 'forbidden'
    const v = await source(data).getPublish('hare')
    expect(v?.ready).toBe(false)
    expect(v?.blockedReasons).toContain('あさひさんの歌詞は利用できません。')
    expect(v?.consents.find((c) => c.holderId === 'h-asahi')?.done).toBe(false)
  })

  it('⑤ 使ってもらう時の希望は、この Version で生まれた貢献に設定があるかで決まる', async () => {
    expect((await source(SAMPLE).getPublish('hare'))?.steps.find((x) => x.key === 'reuse')?.done).toBe(true)
    const data = clone()
    data.reusePolicies = data.reusePolicies.filter((x) => x.contributionId !== 'c6-vocal')
    expect((await source(data).getPublish('hare'))?.steps.find((x) => x.key === 'reuse')?.done).toBe(false)
  })

  it('① 音は、その Version が使う素材があるかで決まる', async () => {
    const data = clone()
    const version = data.versions.find((x) => x.id === 'v-hare')
    ;(version as { materialIds: string[] }).materialIds = []
    expect((await source(data).getPublish('hare'))?.steps.find((x) => x.key === 'sound')?.done).toBe(false)
  })

  it('公開済みの Version は、公開する前の確認に出さない', async () => {
    const data = clone()
    const draft = data.publishDrafts.find((x) => x.id === 'hare')
    ;(draft as { versionId: string }).versionId = 'v-minato' // すでに公開済み
    expect(await source(data).getPublish('hare')).toBeNull()
  })

  it('公開前の下書きは「この歌から生まれた歌」に出さない（まだ生まれていない）', async () => {
    const minato = await source(SAMPLE).getSong('minato')
    expect(minato?.children.map((c) => c.songId)).toEqual(['futatabi', 'futari', null])
  })
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('止まる理由を固定の文字列に戻すと、入力を変えても文が変わらない＝再検証の試験を通せない', async () => {
    const OLD_FIXED_REASON = 'りくさんの同意を待っています。'
    const data = clone()
    const p = data.permissions.find((x) => x.id === 'p-hare-vocal')
    ;(p as { events: { kind: string; actorHolderId: string | null; at: string }[] }).events.push({
      kind: 'revoked',
      actorHolderId: 'h-minato',
      at: '2026-09-18T00:00:00Z',
    })
    const shown = (await source(data).getPublish('hare'))?.blockedReasons[0]
    expect(shown).toBe('みなとさんの同意を待っています。') // いま＝再検証の結果から出た人の名前
    expect(OLD_FIXED_REASON).not.toBe(shown) // 固定の文字列は入力を見ない
  })

  it('ステップの「済」を固定にすると、素材の申告を消しても ④ が外れない＝素材の試験を通せない', async () => {
    const ALL_DONE = ['① 音', '② クレジット', '③ 届け方', '④ 素材と元の歌', '⑤ 使ってもらう時の希望']
    const data = clone()
    ;(data.materials.find((x) => x.id === 'm-hare') as { provenance: unknown }).provenance = null
    const steps = (await source(data).getPublish('hare'))?.steps ?? []
    const done = steps.filter((x) => x.done).map((x) => x.label)
    expect(done).not.toEqual(ALL_DONE) // いま＝checkMaterials の結果で ④ が外れる
    expect(done).toEqual(['① 音', '② クレジット', '③ 届け方', '⑤ 使ってもらう時の希望'])
  })
})
