import { describe, it, expect, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import type { ReactElement } from 'react'
import { createElement } from 'react'
import AskPage from './songs/[id]/grow/ask/page'
import GrowPage from './songs/[id]/grow/page'
import DraftPage from './drafts/[id]/page'
import { InheritForm } from './songs/[id]/grow/InheritForm'
import { COPY } from '@/components/ui'
import { createSampleSource, setUiDataSource, type SongView, type UiDataSource } from '@/lib/ui-data'
import { SAMPLE } from '@/lib/preview/sample'
import type { SampleData } from '@/lib/preview/sample'
import type { ReuseMode } from '@/lib/domain/types'

// J 使わせてとお願いする（設計書 utatane-focus-screens-spec.md §3 J・試作 j-ask）。
// ・「承認が必要」かは lib/domain の effectiveMode の結果から来る（固定値にしない）
// ・状態：お願いの内容／送った後／返事待ち／うまくいかなかったとき／承認が必要な物がない
// ・★本物の送信はしない。見本の読み口の中で返事待ちに進むだけ

const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
const ask = (searchParams: Record<string, string | string[]>) => ({ params: { id: 'minato' }, searchParams })
const clone = (): SampleData => JSON.parse(JSON.stringify(SAMPLE)) as SampleData

/** 見本を書き換えないよう、試験ごとに新しい読み口を立てる */
const fresh = (data: SampleData = clone()): UiDataSource => {
  const src = createSampleSource(data)
  restore = setUiDataSource(src)
  return src
}

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

// ── お願いの内容 ─────────────────────────────────────────

describe('お願いの内容（設計書 §3 J・試作 j-ask）', () => {
  it('承認が必要な物だけが並び、相手の名前と設計書の文言が出る', async () => {
    fresh()
    const html = await render(AskPage, ask({ take: ['c-lyrics', 'c-melody', 'c-vocal'] }))
    expect(html).toContain('data-screen="ask"')
    expect(html).toContain(COPY.askTitle)
    expect(html).toContain(COPY.askBody)
    // 承認が必要な2つだけ（自由に使える歌詞は並べない）
    expect(html).toContain('data-ask="c-melody"')
    expect(html).toContain('data-ask="c-vocal"')
    expect(html).not.toContain('data-ask="c-lyrics"')
    expect(html).toContain('お願いする相手：あさひさん')
    expect(html).toContain('お願いする相手：みなとさん')
    expect(html).toContain('承認が必要')
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('お願いを送って続ける')
    expect(html).toContain('お願いせずに続ける')
  })

  it('承認の要る物だけを選んだときは［選び直す］にする（お願いをやめると0件になるため）', async () => {
    fresh()
    const html = await render(AskPage, ask({ take: 'c-melody' }))
    expect(html).not.toContain('お願いせずに続ける')
    expect(html).toContain('選び直す')
    expect(html).toContain('選んだ物がすべて承認の要る物なので、お願いをやめると受け継ぐ物が無くなります。')
  })

  it('「利用できません」は住所で混ぜてもお願いに入らない', async () => {
    const src = fresh()
    const v = await src.getPermissionAsk('minato', ['c-mix', 'c-melody'])
    expect(v?.items.map((i) => i.id)).toEqual(['c-melody'])
  })

  it('承認が必要な物がないときは、この道に入らない', async () => {
    fresh()
    const html = await render(AskPage, ask({ take: 'c-lyrics' }))
    expect(html).toContain('data-screen="ask-none"')
    expect(html).toContain('選んだ物に、承認が必要な物はありません。そのまま受け継げます。')
  })

  it('無い歌は 404', async () => {
    fresh()
    await expect(render(AskPage, { params: { id: '無い歌' }, searchParams: { take: 'c-melody' } })).rejects.toThrow()
  })
})

// ── 送った後・返事待ち ──────────────────────────────────

describe('送った後と、返事待ち', () => {
  it('送った後：「お願いを送りました」「返事が来たら使えます。」と［続ける］', async () => {
    fresh()
    const html = await render(AskPage, ask({ take: 'c-melody', step: 'sent' }))
    expect(html).toContain('data-screen="ask-sent"')
    expect(html).toContain(COPY.askSentTitle)
    expect(html).toContain(COPY.askReply)
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain('続ける')
    // お願い中の物も「受け継ぐ物」に数えて、何を加えるかへ進む
    expect(html).toContain('ask=c-melody')
  })

  it('返事待ち：もう一度開いても送り直さず、「返事を待っています」と［続ける］になる', async () => {
    const src = fresh()
    const before = await render(AskPage, ask({ take: 'c-melody' }))
    expect(before).toContain('data-waiting="false"')
    expect(before).toContain('お願いを送って続ける')

    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })

    const after = await render(AskPage, ask({ take: 'c-melody' }))
    expect(after).toContain('data-waiting="true"')
    expect(after).toContain(COPY.askWaiting)
    expect(after).toContain(COPY.askWaitingBody)
    expect(after).not.toContain('お願いを送って続ける')
    expect(count(after, 'data-ui="primary"')).toBe(1)
    expect(after).toContain('続ける')
  })

  it('同じ物に二重のお願いを作らない', async () => {
    const src = fresh()
    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })
    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })
    const v = await src.getPermissionAsk('minato', ['c-melody'])
    expect(v?.items.filter((i) => i.waiting)).toHaveLength(1)
  })

  it('一部だけ送ったときは、送った物だけが返事待ちになる', async () => {
    const src = fresh()
    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })
    const v = await src.getPermissionAsk('minato', ['c-melody', 'c-vocal'])
    expect(v?.items.map((i) => `${i.id}:${i.waiting}`)).toEqual(['c-melody:true', 'c-vocal:false'])
    expect(v?.waiting).toBe(false) // 全部そろって初めて返事待ちの見せ方にする
  })

  it('うまくいかなかったとき：「お願いを送れませんでした」と［もう一度］', async () => {
    fresh()
    const html = await render(AskPage, ask({ take: 'c-melody', state: 'error' }))
    expect(html).toContain('data-screen="ask-error"')
    expect(html).toContain(COPY.askSendErrorTitle)
    expect(html).toContain(COPY.networkErrorShort)
    expect(count(html, 'data-ui="primary"')).toBe(1)
    expect(html).toContain(COPY.retry)
  })

  it('エラーの住所では送らない（返事待ちにしない）', async () => {
    const src = fresh()
    await render(AskPage, ask({ take: 'c-melody', state: 'error' }))
    expect((await src.getPermissionAsk('minato', ['c-melody']))?.waiting).toBe(false)
  })
})

// ── effectiveMode の結果でだけ、この道に入る ────────────────────

describe('「承認が必要」は effectiveMode の結果から（固定値にしない）', () => {
  it('再利用の設定を「自由」に変えると、お願いの道に入らない', async () => {
    const data = clone()
    const p = data.reusePolicies.find((x) => x.contributionId === 'c-melody')
    ;(p as { mode: ReuseMode }).mode = 'free'
    fresh(data)
    const v = await createSampleSource(data).getPermissionAsk('minato', ['c-melody'])
    expect(v?.items).toEqual([])
    const html = await render(AskPage, ask({ take: 'c-melody' }))
    expect(html).toContain('data-screen="ask-none"')
  })

  it('設定を「この Version だけ」にすると、利用できませんになりお願いの道に入らない', async () => {
    const data = clone()
    const p = data.reusePolicies.find((x) => x.contributionId === 'c-melody')
    ;(p as { scope: string }).scope = 'this_version_only'
    const v = await createSampleSource(data).getPermissionAsk('minato', ['c-melody'])
    expect(v?.items).toEqual([])
  })

  it('設定が無い貢献は、初期値「承認が必要」なのでお願いの道に入る', async () => {
    const src = fresh()
    const v = await src.getPermissionAsk('futari', ['c3-piano'])
    expect(v?.items.map((i) => i.statusLabel)).toEqual(['承認が必要'])
  })

  it('何を受け継ぐかのフォームは、承認が必要な物を選んだときだけお願いの住所へ送る', async () => {
    const song = (await createSampleSource(clone()).getSong('minato')) as SongView
    const props = {
      songTitle: '港の灯り',
      action: '/ui/songs/minato/grow',
      askAction: '/ui/songs/minato/grow/ask',
      backHref: '/ui/songs/minato',
      candidates: song.inherit,
    }
    const freeOnly = renderToStaticMarkup(createElement(InheritForm, { ...props, initialSelected: ['c-lyrics'] }))
    expect(freeOnly).toContain('data-ask="false"')
    expect(freeOnly).toContain('action="/ui/songs/minato/grow"')
    const withApproval = renderToStaticMarkup(createElement(InheritForm, { ...props, initialSelected: ['c-melody'] }))
    expect(withApproval).toContain('data-ask="true"')
    expect(withApproval).toContain('action="/ui/songs/minato/grow/ask"')
  })

  it('住所で直接「次へ」に承認の要る物を混ぜても、お願いの画面へ送られる', async () => {
    fresh()
    await expect(
      render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'next', take: ['c-lyrics', 'c-melody'] } }),
    ).rejects.toThrow(/NEXT_REDIRECT/)
  })
})

// ── 追補2点（受け継ぐ物は最低1つ）を守る ──────────────────────

describe('追補2点を守る', () => {
  it('お願い中の物だけでも「受け継ぐ物」に数えて、何を加えるかへ進める', async () => {
    fresh()
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'add', take: '', ask: 'c-melody' } })
    expect(html).toContain('data-screen="grow-add"')
  })

  it('お願い中の物だけの下書きも作れる（0件ではない）', async () => {
    fresh()
    const html = await render(DraftPage, { params: { id: 'new' }, searchParams: { from: 'minato', take: '', ask: 'c-melody' } })
    expect(html).toContain('下書きに保存しました')
    expect(html).toContain('お願い中')
    expect(html).toContain('あさひさんの曲')
    expect(html).toContain('（返事が来たら使えます）')
  })

  it('0件のままでは、何を受け継ぐかに留まる', async () => {
    fresh()
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'add', take: '', ask: '' } })
    expect(html).toContain('data-screen="grow-inherit"')
  })
})

// ── 仮の形であること ─────────────────────────────────────

describe('★本物の送信はしない', () => {
  it('お願いの画面と送った後に、仮の形の一文が出る', async () => {
    fresh()
    const before = await render(AskPage, ask({ take: 'c-melody' }))
    expect(before).toContain('data-provisional="request-send"')
    expect(before).toContain('仮の形：お願いは見本の中にだけ残ります。')
    const sent = await render(AskPage, ask({ take: 'c-melody', step: 'sent' }))
    expect(sent).toContain('data-provisional="request-send"')
  })

  it('送っても、見本の正本（SAMPLE）は書き換わらない', async () => {
    const src = fresh()
    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })
    expect(SAMPLE.permissionRequests).toEqual([])
  })

  it('送っても、決まりの上の許諾（Permission）は増えない', async () => {
    const data = clone()
    const before = data.permissions.length
    const src = createSampleSource(data)
    await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] })
    expect(data.permissions.length).toBe(before)
  })
})

// ── ★空振り確認 ────────────────────────────────────────────

describe('★空振り確認', () => {
  it('お願いの保存をやめると、返事待ちにならない＝試験を通せない', async () => {
    const src = fresh()
    const noSave = { ...src, requestPermission: async () => src.getPermissionAsk('minato', ['c-melody']) } as UiDataSource
    expect((await noSave.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] }))?.waiting).toBe(false)
    expect((await src.requestPermission({ songId: 'minato', contributionIds: ['c-melody'] }))?.waiting).toBe(true)
  })

  it('お願いの対象を固定の一覧に戻すと、設定を変えても同じ物が並ぶ＝この道の試験を通せない', async () => {
    const OLD_FIXED = ['c-melody', 'c-vocal']
    const data = clone()
    ;(data.reusePolicies.find((x) => x.contributionId === 'c-melody') as { mode: ReuseMode }).mode = 'free'
    const shown = (await createSampleSource(data).getPermissionAsk('minato', ['c-melody', 'c-vocal']))?.items.map((i) => i.id)
    expect(shown).toEqual(['c-vocal']) // いま＝effectiveMode の結果
    expect(shown).not.toEqual(OLD_FIXED)
  })
})
