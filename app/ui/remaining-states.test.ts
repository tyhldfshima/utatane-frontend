import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import JoinPage from './songs/[id]/join/page'
import ThanksPage from './songs/[id]/thanks/page'
import { MATERIAL_REQUIRED_REASON, NO_MATERIAL_MESSAGE, MATERIALS_HREF } from './songs/[id]/join/SubmitForm'
import { COPY, giftGate } from '@/components/ui'
import { createSampleSource, setUiDataSource, type UiDataSource } from '@/lib/ui-data'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'

// 見本の上で作れる残りの画面の状態（棚卸し 3514b487 の項目 #3 #5 #6 #7）。
// ・B 送る：置いた素材（§3 K）から選ぶ。素材が無いときも設計書どおり
// ・C 利用不可（足りない・上限）／D 読み込み中・エラー・Y4 完成後／E 利用不可・Y4 完成後
// ★上限の値と本物の判定は中央の口待ち。見本の値で出す
// ★Y4 の切り替えは components/ui/y4.ts の Y4_PHASE の1か所だけ

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
const thanks = (searchParams: Record<string, string>) => ({ params: { id: 'minato' }, searchParams })
const join = (searchParams: Record<string, string>) => ({ params: { id: 'minato' }, searchParams })

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
  vi.restoreAllMocks()
})
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

/** 見本を書き換えないよう、試験ごとに新しい読み口を立てる */
const fresh = (edit?: (d: SampleData) => void): UiDataSource => {
  const data = clone()
  edit?.(data)
  const src = createSampleSource(data)
  restore = setUiDataSource(src)
  return src
}

// ── B 送る：置いた素材から選ぶ ───────────────────────────

describe('B 送る：置いた素材から選ぶ（項目 #3）', () => {
  it('置いた素材が並び、選ぶまでは送れない', async () => {
    fresh()
    const html = await render(JoinPage, join({ step: 'submit', role: 'guitar' }))
    expect(html).toContain('data-screen="join-submit"')
    expect(html).toContain('data-part="materials"')
    expect(html).toContain('data-material="f-guitar-1"')
    expect(html).toContain('ギター_1.wav')
    expect(html).toContain('4.2 MB・9月18日')
    expect(html).toContain('data-picked="none"')
    // 選ぶまでは押せない（理由の一文つき）
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(html).toContain(MATERIAL_REQUIRED_REASON)
    // 送る先は、選んだ物を持って「送りました」へ
    expect(html).toContain('name="material"')
    expect(html).toContain('value="sent"')
  })

  it('素材が1つも無いときは、置き場への道を出す（設計書 §3 K の空の文言）', async () => {
    fresh((d) => {
      d.myMaterials = []
    })
    const html = await render(JoinPage, join({ step: 'submit', role: 'guitar' }))
    expect(html).toContain('data-part="materials-empty"')
    expect(html).toContain(NO_MATERIAL_MESSAGE)
    expect(html).toContain(`href="${MATERIALS_HREF}"`)
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(html).not.toContain('data-part="materials"')
  })

  it('見本のファイル名を出すだけの「仮の形」は、もう出ない', async () => {
    fresh()
    const html = await render(JoinPage, join({ step: 'submit', role: 'guitar' }))
    expect(html).not.toContain('送る物（仮の形）')
    expect(html).not.toContain('ファイルを選ぶ所は、保存の場所とつなぐ便で作ります')
    expect(html).toContain('ギター_1.wav')
  })

  it('★送る操作そのものは、まだ相手に届かないと画面に書いてある', async () => {
    fresh()
    const html = await render(JoinPage, join({ step: 'submit', role: 'guitar' }))
    expect(html).toContain('data-provisional="join-send"')
    expect(html).toContain('仮の形：送る操作は、まだ相手に届きません。')
  })

  it('募集が1つのときも、同じように素材から選ぶ', async () => {
    fresh()
    const html = await render(JoinPage, { params: { id: 'yoake' }, searchParams: {} })
    expect(html).toContain('data-auto-role="true"')
    expect(html).toContain('data-part="materials"')
    expect(html).toContain('作曲で参加')
  })
})

// ── C 利用不可（足りない・上限） ──────────────────────────

describe('C 利用不可（足りない・上限）（項目 #5）', () => {
  it('上限を超えると「1回に贈れるのは、設定の上限までです。」で止まる', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ amount: '500' }))
    expect(html).toContain('data-block="over-limit"')
    expect(html).toContain(COPY.giftOverLimit)
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('上限の中なら、今までどおり確認へ進める', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ amount: '300' }))
    expect(html).toContain('data-block="none"')
    expect(html).not.toContain(COPY.giftOverLimit)
    expect(count(html, 'data-ui="primary"')).toBe(1)
  })

  it('足りないときは、残高を入れた設計書どおりの文言で止まる', async () => {
    fresh((d) => {
      d.gift.balance = 200
      d.gift.perGiftLimit = 500
    })
    const html = await render(ThanksPage, thanks({ amount: '300' }))
    expect(html).toContain('data-block="short"')
    expect(html).toContain('TYP が足りません。いまは 200 TYP まで贈れます。')
    expect(count(html, 'data-ui="primary"')).toBe(0)
  })

  it('足りないと上限の両方に当たるときは、足りないを出す', async () => {
    fresh((d) => {
      d.gift.balance = 200
      d.gift.perGiftLimit = 100
    })
    const html = await render(ThanksPage, thanks({ amount: '300' }))
    expect(html).toContain('data-block="short"')
    expect(html).not.toContain(COPY.giftOverLimit)
  })

  it('★上限の値が見本であることを画面に書いてある', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({}))
    expect(html).toContain('量の札と1回の上限は見本値です（仮の形：本物は中央の設定から読みます）。')
  })
})

// ── D 贈る前の確認の残り3状態 ─────────────────────────────

describe('D 贈る前の確認：読み込み中・エラー・Y4 完成後（項目 #6）', () => {
  it('読み込み中：［贈る］を押せない「贈っています」に置き換える', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ step: 'confirm', amount: '300', state: 'sending' }))
    expect(html).toContain('data-screen="thanks-confirm"')
    expect(html).toContain('data-state="sending"')
    expect(html).toContain('data-ui="busy"')
    expect(html).toContain(COPY.giftSending)
    expect(count(html, 'data-ui="primary"')).toBe(0)
    // 二重に送らないよう、戻る道も出さない
    expect(html).not.toContain(COPY.back)
  })

  it('エラー（贈る前に止まった）：設計書の文言を出し、主ボタンを出さない', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ step: 'confirm', amount: '300', state: 'error' }))
    expect(html).toContain('data-state="error"')
    expect(html).toContain(COPY.giftBlocked)
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(html).toContain(COPY.back)
  })

  it('通常は、今までどおり［贈る］が出る', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ step: 'confirm', amount: '300' }))
    expect(html).toContain('data-state="normal"')
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain(COPY.giftIrreversible)
    expect(html).not.toContain('data-part="y4-note"')
  })
})

// ── E 結果の残り2状態 ────────────────────────────────────

describe('E 結果：利用不可（いま止まっている）・Y4 完成後（項目 #7）', () => {
  it('いま止まっているとき：設計書の文言を出す', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ step: 'result', amount: '300', r: 'paused' }))
    expect(html).toContain('data-result="paused"')
    expect(html).toContain(COPY.giftPausedTitle)
    expect(html).toContain(COPY.giftPausedBody)
    expect(count(html, 'data-ui="primary"')).toBe(1) // 閉じる
  })

  it('通常の結果は、今までどおり', async () => {
    fresh()
    const html = await render(ThanksPage, thanks({ step: 'result', amount: '300' }))
    expect(html).toContain('ありがとうを届けました')
    expect(html).not.toContain('data-part="y4-note"')
  })
})

// ── Y4 完成後は、切り替えの1か所だけで出る ──────────────────

describe('Y4 完成後の見せ方は、components/ui/y4.ts の1か所で切り替わる', () => {
  it('決まりの側：受け取れない方がいる歌は、切り替えると贈れる形＋一文になる', () => {
    const input = {
      ruleEstablished: true,
      selfIsParticipant: false,
      selfIsRecipient: false,
      receivableCount: 2,
      unreceivableCount: 1,
      pendingResult: false,
    }
    expect(giftGate({ ...input, phase: 'before-acceptance' }).kind).toBe('unavailable-y4')
    const after = giftGate({ ...input, phase: 'after-acceptance' })
    expect(after.kind).toBe('available')
    expect('note' in after ? after.note : null).toBe(COPY.giftAfterY4Note)
  })

  it('画面の側：切り替えると D と E に Y4 完成後の一文が出る', async () => {
    vi.resetModules()
    // ★y4.ts の Y4_PHASE を 'after-acceptance' に変えたのと同じ状態にする。
    //   giftGate は自分の中の Y4_PHASE を既定にするので、既定だけを差し替える。
    vi.doMock('@/components/ui/y4', async (importOriginal) => {
      const mod = (await importOriginal()) as {
        giftGate: (i: Record<string, unknown>) => unknown
      } & Record<string, unknown>
      return {
        ...mod,
        Y4_PHASE: 'after-acceptance',
        giftGate: (i: Record<string, unknown>) => mod.giftGate({ ...i, phase: i.phase ?? 'after-acceptance' }),
      }
    })
    const mod = await import('@/lib/ui-data')
    const Page = (await import('./songs/[id]/thanks/page')).default
    const back = mod.setUiDataSource(mod.createSampleSource(clone()))
    try {
      // 受け取れない方がいる歌（futatabi）。切り替え前は贈れない
      const confirm = await render(Page as never, { params: { id: 'futatabi' }, searchParams: { step: 'confirm', amount: '300' } })
      expect(confirm).toContain('data-part="y4-note"')
      expect(confirm).toContain(COPY.giftAfterY4Note)
      const result = await render(Page as never, { params: { id: 'futatabi' }, searchParams: { step: 'result', amount: '300' } })
      expect(result).toContain('data-part="y4-note"')
      expect(result).toContain(COPY.giftAfterY4Note)
    } finally {
      back()
      vi.doUnmock('@/components/ui/y4')
      vi.resetModules()
    }
  })

  it('切り替える前は、D にも E にも一文を出さない', async () => {
    fresh()
    const confirm = await render(ThanksPage, { params: { id: 'futatabi' }, searchParams: { step: 'confirm', amount: '300' } })
    // 受け取れない方がいる歌は、切り替え前はそもそも贈れない
    expect(confirm).toContain('data-state="unavailable-y4"')
    expect(confirm).not.toContain('data-part="y4-note"')
  })
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('上限を読まずに固定の大きな値に戻すと、上限で止まらない＝この道の試験を通せない', async () => {
    const src = fresh()
    const real = (await src.getGiftSettings()).perGiftLimit
    const OLD_FIXED = Number.MAX_SAFE_INTEGER
    expect(real).toBe(300) // いま＝読み口から来た見本の値
    expect(500 > real).toBe(true) // 500 は上限を超える
    expect(500 > OLD_FIXED).toBe(false) // 固定の大きな値では、いつまでも止まらない
  })

  it('素材の一覧を読まずに見本のファイル名に戻すと、素材が無いときの道を通せない', async () => {
    const src = fresh((d) => {
      d.myMaterials = []
    })
    const OLD_FIXED_NAME = 'ギター_1'
    expect(await src.listMyMaterials()).toEqual([]) // いま＝読み口から来た一覧
    const html = await render(JoinPage, join({ step: 'submit', role: 'guitar' }))
    expect(html).toContain(NO_MATERIAL_MESSAGE)
    expect(html).not.toContain(OLD_FIXED_NAME) // 固定の名前なら、素材が無くても出てしまう
  })
})
