import { describe, it, expect } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { createRequire } from 'node:module'
import SongPage from './songs/[id]/page'
import JoinPage from './songs/[id]/join/page'
import GrowPage from './songs/[id]/grow/page'
import AskPage from './songs/[id]/grow/ask/page'
import ThanksPage from './songs/[id]/thanks/page'
import TreePage from './songs/[id]/tree/page'
import DraftPage from './drafts/[id]/page'
import ConsentPage from './inbox/consent/[id]/page'
import InboxPage from './inbox/page'
import MePage from './me/page'
import HomePage from './page'
import CreatePage from './create/page'
import { INHERIT_REQUIRED_REASON } from './songs/[id]/grow/InheritForm'
import {
  NEW_WITHOUT_INHERIT_HREF,
  canProceedInherit,
  creditsOf,
  creditText,
  recruitmentText,
  resolveJoinRole,
  splitSelection,
} from '@/lib/preview/model'
import { sampleSource, type SongView } from '@/lib/ui-data'
import { COPY, INQUIRY_STORAGE_KEY, startInquiry, takeInquiry } from '@/components/ui'
import { isNewUiPath } from '@/components/LegacyChrome'

// react-dom/server の型は依存に無いので、型を付けて読み込む（package.json を変えない）。
const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: ReactElement) => string }

// 画面は読み口（lib/ui-data）から待って読むので、まず画面を await してから描く。
// 画面の部品は props の形がそれぞれ違うので、ここでは形を問わずに描く。
const render = async (C: (props: never) => unknown, props: Record<string, unknown> = {}) => {
  const el = await (C as unknown as (p: Record<string, unknown>) => ReactElement | Promise<ReactElement>)(props)
  return renderToStaticMarkup(el)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
const song = (id: string) => ({ params: { id }, searchParams: {} })
// ★画面と同じ読み口から取る（試験も見本のデータを直に読まない）
const view = async (id: string): Promise<SongView> => (await sampleSource.getSong(id)) as SongView
const SONG_IDS = ['minato', 'futatabi', 'futari', 'yoake']

describe('この歌をつくった人（えふさん確定 ①）', () => {
  it('採用され表示対象の人が、全員・役割付きで出る（同じ人は1行にまとめる）', async () => {
    const lines = (await view('minato')).credits.map(creditText)
    expect(lines).toEqual(['あさひさん　歌詞・作曲', 'みなとさん　ボーカル', 'つばささん　ギター', 'りくさん　MIX'])
    const html = await render(SongPage, song('minato'))
    for (const l of lines) expect(html).toContain(l)
  })
  it('採用されなかった提出物の人は出さない', async () => {
    expect(await render(SongPage, song('minato'))).not.toContain('ひなたさん')
  })
  it('人を足さない：歌詞だけの種には、歌詞の人だけが出る（作曲の人を作らない）', async () => {
    expect((await view('yoake')).credits.map(creditText)).toEqual(['ひなたさん　歌詞'])
  })
  it('表示対象から外れた貢献は出さない', async () => {
    const hidden = (await view('minato')).contributions.map((c) => (c.id === 'c-mix' ? { ...c, visible: false } : c))
    expect(creditsOf(hidden).map((l) => l.name)).not.toContain('りく')
  })
})

describe('この歌の制作に参加する（②③）', () => {
  it('募集があるときだけ参加のカードを出し、募集内容を先に見せる', async () => {
    const html = await render(SongPage, song('minato'))
    expect(html).toContain('data-part="join-card"')
    expect(html).toContain('この歌の制作に参加する')
    expect(html).toContain('あさひさんが一緒につくる仲間を募集しています。')
    expect(html).toContain('募集中：ギター・コーラス')
  })
  it('募集がないとき参加のカードが出ない', async () => {
    expect(recruitmentText((await view('futatabi')).recruitment)).toBeNull()
    expect(await render(SongPage, song('futatabi'))).not.toContain('data-part="join-card"')
  })
  it('「この曲に参加する」は使わない', async () => {
    for (const id of SONG_IDS) expect(await render(SongPage, song(id))).not.toContain('この曲に参加する')
  })
  it('参加ボタンの後に、募集されている役割から「何で参加するか」を選ぶ（歌う人だけではない）', async () => {
    const html = await render(JoinPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('何で参加しますか')
    expect(html).toContain('ギターで参加')
    expect(html).toContain('コーラスで参加')
    expect(html).toContain('step=submit&amp;role=guitar')
  })
  it('送った後も、主催が入れるまでは「この歌に入った」にしない', async () => {
    const sent = await render(JoinPage, { params: { id: 'minato' }, searchParams: { step: 'sent', role: 'guitar' } })
    expect(sent).toContain('送りました')
    expect(sent).toContain('まだこの歌には入っていません')
    const draft = await render(DraftPage, { params: { id: 'minato-join' }, searchParams: { sent: 'guitar' } })
    expect(draft).toContain('送った物（まだこの歌には入っていません）')
  })
  it('募集がない歌に参加の画面を直接開いても、参加できない', async () => {
    expect(await render(JoinPage, { params: { id: 'futatabi' }, searchParams: {} })).toContain('この歌は、いま参加を募集していません。')
  })
})

describe('新しい Version として育てる（④⑤⑥）', () => {
  it('募集とは別のカードで、自分が主催する新しい Version と見せる', async () => {
    const html = await render(SongPage, song('futatabi'))
    expect(html).toContain('data-part="grow-card"')
    expect(html).toContain('あなたが主催する新しい Version')
  })
  it('何を受け継ぐか：元の歌に実在する物だけ・状態つき。利用できませんは選べない', async () => {
    const cands = (await view('minato')).inherit
    expect(cands.map((c) => `${c.label}／${c.statusLabel}`)).toEqual([
      'あさひさんの歌詞／自由に使えます',
      'あさひさんの曲／承認が必要',
      'みなとさんのボーカル／承認が必要',
      'つばささんのギター／自由に使えます',
      'りくさんのMIX／利用できません',
    ])
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toMatch(/data-candidate="c-mix"[^>]*>\s*<input[^>]*disabled=""/)
    expect(html).toContain('何を受け継ぎますか？')
  })
  it('住所で利用できません を選ばれても、受け継がない', async () => {
    const cands = (await view('minato')).inherit
    const split = splitSelection(cands, ['c-mix', 'c-lyrics'])
    expect(split.free.map((c) => c.id)).toEqual(['c-lyrics'])
    expect(split.needsApproval).toEqual([])
  })
  it('承認が必要を選ぶと、お願いの画面へ進む', async () => {
    const html = await render(AskPage, { params: { id: 'minato' }, searchParams: { take: ['c-lyrics', 'c-melody'] } })
    expect(html).toContain('data-screen="ask"')
    expect(html).toContain('使わせてとお願いする')
    expect(html).toContain('あさひさんの曲')
  })
  it('何を加えるかは大きな区分だけで、あとから足せる', async () => {
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'add', take: 'c-lyrics' } })
    for (const w of ['作詞', '作曲', '歌唱', '演奏', 'その他']) expect(html).toContain(w)
    expect(html).toContain('あとから足したり、仲間を募集したりできます')
    const draft = await render(DraftPage, { params: { id: 'new' }, searchParams: { from: 'minato', take: 'c-lyrics', add: 'vocal' } })
    expect(draft).toContain('下書きに保存しました')
    expect(draft).toContain('あさひさんの歌詞')
    expect(draft).toContain('歌唱')
  })
})

describe('ありがとうを贈る', () => {
  it('歌の画面の主ボタンは1つだけ（贈れる歌）', async () => {
    expect(count(await render(SongPage, song('minato')), 'data-ui="primary"')).toBe(1)
  })
  it('受け取れない方がいる歌は、Y4 本番受入まで贈れない（暫定の印つき）', async () => {
    const html = await render(SongPage, song('futatabi'))
    expect(html).toContain('data-provisional="y4"')
    expect(html).toContain(COPY.giftUnavailableY4)
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(await render(ThanksPage, { params: { id: 'futatabi' }, searchParams: {} })).toContain('data-state="unavailable-y4"')
  })
  it('量 → 確認 → 結果 と進み、確認で取り消せないことを言う', async () => {
    const amount = await render(ThanksPage, { params: { id: 'minato' }, searchParams: { amount: '300' } })
    expect(amount).toContain('step=confirm&amp;amount=300')
    const confirm = await render(ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'confirm', amount: '300' } })
    expect(confirm).toContain('贈ったあとで、取り消すことはできません。')
    expect(confirm).toContain('step=result&amp;amount=300')
    const result = await render(ThanksPage, { params: { id: 'minato' }, searchParams: { step: 'result', amount: '300' } })
    expect(result).toContain('ありがとうを届けました')
  })
  it('量を選ぶ前は、押せない理由つき', async () => {
    expect(await render(ThanksPage, { params: { id: 'minato' }, searchParams: {} })).toContain('量を選んでください。')
  })
  it('表記は「あなたのTYPからも減りません」', async () => {
    expect(COPY.giftAfterY4Note).toBe('受け取れない方の分は送られず、あなたのTYPからも減りません')
  })
})

describe('対応待ち → 届け方 → 公開への同意', () => {
  it('対応待ちから、届け方のステップへ着地する', async () => {
    expect(await render(InboxPage)).toContain('/ui/inbox/consent/ame#step-3')
  })
  it('確認の小窓を1回挟み、同意しても公開はまだと伝える', async () => {
    const dialog = await render(ConsentPage, { params: { id: 'ame' }, searchParams: { confirm: '1' } })
    expect(dialog).toContain('role="dialog"')
    expect(dialog).toContain('/ui/inbox/consent/ame?done=1')
    const done = await render(ConsentPage, { params: { id: 'ame' }, searchParams: { done: '1' } })
    expect(done).toContain('まだ公開はされていません')
  })
})

describe('生まれた流れ・自分・ホーム', () => {
  it('生まれた流れから、育った歌と、育てるへ進める', async () => {
    const html = await render(TreePage, song('minato'))
    expect(html).toContain('/ui/songs/futari')
    expect(html).toContain('/ui/songs/minato/grow')
    expect(html).toContain('いまは見られない歌')
  })
  it('自分は管理画面が先で、公開プロフィールへ進める。TYP の残高・入口は置かない', async () => {
    const html = await render(MePage)
    expect(html).toContain('/ui/me/profile')
    expect(html).not.toContain('TYP')
    expect(html).not.toContain('TYポイント')
  })
  it('ホームの段の見出しは線のアイコン（絵文字を使わない）', async () => {
    const html = await render(HomePage)
    expect(html).toContain('data-icon="seed"')
    for (const emoji of ['🌱', '🎤', '🎸', '🌳', '✨']) expect(html).not.toContain(emoji)
  })
})

describe('取引についての問い合わせ（番号を見せない）', () => {
  it('移る先の住所に取引の番号が入らず、端末の中で引き継ぐ', async () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const id = '00000000-0000-4000-8000-000000000001'
    const url = startInquiry(id, storage)
    expect(url).toBe('/ui/inquiry')
    expect(url).not.toContain(id)
    expect(store.has(INQUIRY_STORAGE_KEY)).toBe(true)
    expect(takeInquiry(storage)?.transactionId).toBe(id)
    expect(takeInquiry(storage)).toBeNull()
  })
})

describe('今までの画面の枠', () => {
  it('新しい画面（/ui・/dev）にだけ、今までの枠を重ねない', async () => {
    expect(isNewUiPath('/ui')).toBe(true)
    expect(isNewUiPath('/ui/songs/minato')).toBe(true)
    expect(isNewUiPath('/dev/ui')).toBe(true)
    expect(isNewUiPath('/feed')).toBe(false)
    expect(isNewUiPath('/uix')).toBe(false)
  })
})

// ── えふさん確定 2026-09-19 追補（参加の役割選択の省略・受け継ぐ物は最低1つ） ──

describe('参加：募集の役割が1つなら、選ぶ操作だけを省く', () => {
  it('募集1つ：選択画面を出さず、その役割を自動で選んで「送る」へ進む。役割は画面に出す', async () => {
    const html = await render(JoinPage, { params: { id: 'yoake' }, searchParams: {} })
    expect(html).toContain('data-screen="join-submit"')
    expect(html).toContain('data-auto-role="true"')
    expect(html).not.toContain('何で参加しますか')
    expect(html).toContain('作曲で参加')
    expect(html).toContain('作曲を送る')
  })
  it('募集1つ：送りました・制作中の歌にも「作曲で参加」を出す', async () => {
    const sent = await render(JoinPage, { params: { id: 'yoake' }, searchParams: { step: 'sent' } })
    expect(sent).toContain('送りました')
    expect(sent).toContain('作曲で参加')
    expect(await render(DraftPage, { params: { id: 'yoake-join' }, searchParams: { sent: 'melody' } })).toContain('作曲で参加')
  })
  it('募集1つ：戻る先は選択画面ではなく歌の画面（自動で進む画面へ戻り続けない）', async () => {
    const html = await render(JoinPage, { params: { id: 'yoake' }, searchParams: {} })
    expect(html).toContain('href="/ui/songs/yoake"')
    expect(html).not.toContain('何で参加するかへ戻る')
  })
  it('募集複数：今までどおり選択画面が出て、選んだ役割がその後の画面に出る', async () => {
    const role = await render(JoinPage, { params: { id: 'minato' }, searchParams: {} })
    expect(role).toContain('data-screen="join-role"')
    expect(role).toContain('何で参加しますか')
    const submit = await render(JoinPage, { params: { id: 'minato' }, searchParams: { step: 'submit', role: 'chorus' } })
    expect(submit).toContain('data-auto-role="false"')
    expect(submit).toContain('コーラスで参加')
  })
  it('募集複数で役割を選ばずに送る画面を開いても、選択画面に戻る', async () => {
    expect(await render(JoinPage, { params: { id: 'minato' }, searchParams: { step: 'submit' } })).toContain('data-screen="join-role"')
    expect(resolveJoinRole((await view('minato')).recruitment, undefined)).toBeNull()
    expect(resolveJoinRole((await view('yoake')).recruitment, undefined)?.autoSelected).toBe(true)
  })
})

describe('育てる：受け継ぐ物は最低1つ', () => {
  it('何も選んでいない間は［次へ］を押せない（押せない理由の一文つき）', async () => {
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain(INHERIT_REQUIRED_REASON)
    expect(count(html, 'data-ui="primary"')).toBe(0)
    expect(html).toContain('data-ui="unavailable"')
    expect(canProceedInherit(0)).toBe(false)
    expect(canProceedInherit(1)).toBe(true)
  })
  it('住所で0件のまま次へ進もうとしても、何を受け継ぐかに留まる', async () => {
    for (const step of ['next', 'add']) {
      const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: { step } })
      expect(html, step).toContain('data-screen="grow-inherit"')
      expect(html, step).not.toContain('data-screen="grow-add"')
    }
    // 利用できません だけを選んだ形も0件と同じ
    expect(await render(GrowPage, { params: { id: 'minato' }, searchParams: { step: 'next', take: 'c-mix' } })).toContain('data-screen="grow-inherit"')
  })
  it('0件で下書きの住所を開いても、下書きを作らない（元の歌との親子を作らない）', async () => {
    const html = await render(DraftPage, { params: { id: 'new' }, searchParams: { from: 'minato', take: '', add: 'vocal' } })
    expect(html).toContain('data-screen="draft-grown-none"')
    expect(html).not.toContain('下書きに保存しました')
    expect(html).toContain(`href="${NEW_WITHOUT_INHERIT_HREF}"`)
  })
  it('「何も受け継がず、新しくつくる」は ＋つくる の新規作成へ移り、元の歌を持って行かない', async () => {
    const html = await render(GrowPage, { params: { id: 'minato' }, searchParams: {} })
    expect(html).toContain('何も受け継がず、新しくつくる')
    expect(NEW_WITHOUT_INHERIT_HREF).toBe('/ui/create')
    expect(html).toContain('href="/ui/create"')
    expect(html).not.toMatch(/href="\/ui\/create\?/)
    expect(await render(CreatePage)).toContain('data-screen="create"')
  })
  it('承認が必要な物だけを選んだときは「お願いせずに続ける」を出さない（0件になるため）', async () => {
    const html = await render(AskPage, { params: { id: 'minato' }, searchParams: { take: 'c-melody' } })
    expect(html).toContain('data-screen="ask"')
    expect(html).not.toContain('お願いせずに続ける')
    expect(html).toContain('選び直す')
    const both = await render(AskPage, { params: { id: 'minato' }, searchParams: { take: ['c-lyrics', 'c-melody'] } })
    expect(both).toContain('お願いせずに続ける')
  })
})
