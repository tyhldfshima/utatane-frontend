import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import { COPY } from '@/components/ui'
import { SAMPLE, type SampleData } from '@/lib/preview/sample'

// Y4 の切り替えが「1か所」で効くことの確認（棚卸し 4aabfd55 の便3）。
//
// ★決まり（設計書 §2-3・components/ui/y4.ts）：
//   「受け取れない方がいる歌には、Y4 本番受入 PASS まで、ありがとうを贈れない」は暫定。
//   PASS 後は Y4_PHASE を 'after-acceptance' に変える**だけ**で外れる。
//   ★画面の中に別の分かれ道を作らない。
//
// ★この試験が守る事：A・C・D・E の**4つとも**、その1か所で切り替わること。
//   どれか1つでも切り替わらなければ落ちる（＝画面の中に別の分かれ道ができたら気づける）。
//
// ★切り替わり方は画面ごとに違う（設計書 §3）。
//   A … 押せない［ありがとうを贈る］→ 押せる（/thanks への導線が出る）
//   C … 贈れない画面 → **通常と同じ**「量を選ぶ」画面（★一文は出さない＝設計書 §3 C「通常と同じ」）
//   D … 贈る前の確認に「受け取れない方の分は送られず…」の一文が付く
//   E … 結果にも同じ一文が付く
//
// ★この便は試験だけ。app・lib・components の本体は1文字も変えていない。

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}

/** 見本を毎回作り直す（前の試験の書き込みを持ち越さない）。 */
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

// ★受け取れない方がいる歌。この歌だけが Y4 の分かれ道に入る（見本 futatabi）。
const Y4_SONG = 'futatabi'
// ★受け取れない方がいない歌。切り替えても見え方が変わらないことの対（見本 minato）。
const PLAIN_SONG = 'minato'

/** A・C・D・E の4画面を、いまの既定の Y4_PHASE で描く。 */
async function renderFour(songId: string) {
  const mod = await import('@/lib/ui-data')
  const SongPage = (await import('./songs/[id]/page')).default
  const ThanksPage = (await import('./songs/[id]/thanks/page')).default
  const back = mod.setUiDataSource(mod.createSampleSource(clone()))
  try {
    return {
      // A 歌の画面
      a: await render(SongPage as never, { params: { id: songId }, searchParams: {} }),
      // C ありがとう：量を選ぶ
      c: await render(ThanksPage as never, { params: { id: songId }, searchParams: {} }),
      // D ありがとう：贈る前の確認
      d: await render(ThanksPage as never, { params: { id: songId }, searchParams: { step: 'confirm', amount: '300' } }),
      // E ありがとう：結果
      e: await render(ThanksPage as never, { params: { id: songId }, searchParams: { step: 'result', amount: '300' } }),
    }
  } finally {
    back()
  }
}

/** Y4_PHASE を 'after-acceptance' に変えたのと同じ状態にしてから、4画面を描く。 */
async function renderFourAfterFlip(songId: string) {
  vi.resetModules()
  // giftGate は自分の中の Y4_PHASE を既定にするので、既定だけを差し替える。
  vi.doMock('@/components/ui/y4', async (importOriginal) => {
    const mod = (await importOriginal()) as { giftGate: (i: Record<string, unknown>) => unknown } & Record<string, unknown>
    return {
      ...mod,
      Y4_PHASE: 'after-acceptance',
      giftGate: (i: Record<string, unknown>) => mod.giftGate({ ...i, phase: i.phase ?? 'after-acceptance' }),
    }
  })
  try {
    return await renderFour(songId)
  } finally {
    vi.doUnmock('@/components/ui/y4')
    vi.resetModules()
  }
}

afterEach(() => {
  vi.doUnmock('@/components/ui/y4')
  vi.resetModules()
})

describe('Y4：切り替える前（いまの既定）', () => {
  it('A は「贈れません」の札を出し、C は贈る手前で止まり、D も E も先へ進めない', async () => {
    const { a, c, d, e } = await renderFour(Y4_SONG)
    // A 歌の画面：暫定の印つきで「贈れません」
    expect(a).toContain('data-provisional="y4"')
    expect(a).toContain(COPY.giftUnavailableY4)
    // C・D・E：どの入り方でも、贈る画面の中身は出ない
    for (const html of [c, d, e]) {
      expect(html).toContain(COPY.giftUnavailableY4)
      expect(html).not.toContain('data-part="y4-note"')
      expect(html).not.toContain(COPY.giftAfterY4Note)
    }
  })
})

describe('Y4：切り替えた後（Y4_PHASE を 1 か所だけ変える）', () => {
  it('★A・C・D・E の4つとも、見せ方が切り替わる', async () => {
    const before = await renderFour(Y4_SONG)
    const after = await renderFourAfterFlip(Y4_SONG)

    // ── A 歌の画面：札が消え、贈る導線が出る ──
    expect(before.a).toContain('data-provisional="y4"')
    expect(after.a).not.toContain('data-provisional="y4"')
    expect(after.a).not.toContain(COPY.giftUnavailableY4)
    expect(after.a).toContain(`/ui/songs/${Y4_SONG}/thanks`)

    // ── C 量を選ぶ：止まっていた画面が、量を選ぶ画面になる ──
    // ★設計書 §3 C の「Y4 完成後」は「**通常と同じ**」。
    //   だから C には一文（y4-note）を出さない。出ていたら設計書と食い違う。
    expect(before.c).toContain(COPY.giftUnavailableY4)
    expect(before.c).not.toContain('data-screen="thanks-amount"')
    expect(after.c).not.toContain(COPY.giftUnavailableY4)
    expect(after.c).toContain('data-screen="thanks-amount"')
    expect(after.c).not.toContain('data-part="y4-note"')

    // ── D 贈る前の確認：一文が付く ──
    expect(before.d).toContain(COPY.giftUnavailableY4)
    expect(after.d).not.toContain(COPY.giftUnavailableY4)
    expect(after.d).toContain('data-part="y4-note"')
    expect(after.d).toContain(COPY.giftAfterY4Note)

    // ── E 結果：一文が付く ──
    expect(before.e).toContain(COPY.giftUnavailableY4)
    expect(after.e).not.toContain(COPY.giftUnavailableY4)
    expect(after.e).toContain('data-part="y4-note"')
    expect(after.e).toContain(COPY.giftAfterY4Note)

    // ★4つとも「切り替わった」＝前と後で中身が違う
    for (const key of ['a', 'c', 'd', 'e'] as const) {
      expect(after[key]).not.toBe(before[key])
    }
  })

  it('★受け取れない方がいない歌は、切り替えても見え方が変わらない（切り替えが効きすぎていない）', async () => {
    const before = await renderFour(PLAIN_SONG)
    const after = await renderFourAfterFlip(PLAIN_SONG)
    for (const key of ['a', 'c', 'd', 'e'] as const) {
      expect(after[key]).toBe(before[key])
      expect(after[key]).not.toContain(COPY.giftAfterY4Note)
    }
  })
})
