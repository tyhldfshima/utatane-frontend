import React from 'react'
import { notFound } from 'next/navigation'
import { Icon, ScreenFrame, UnavailableButton } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { ADD_OPTIONS } from '@/lib/preview/model'
import { DRAFTS, findSong, hrefSong } from '@/lib/preview/sample'

// W4 制作中の歌。
// ・参加した人から見た形（/ui/drafts/minato-join?sent=役割）
// ・育てて作った自分の歌（/ui/drafts/new?from=元の歌&take=…&add=…）

type Search = { sent?: string; from?: string; take?: string; add?: string; ask?: string }

export default function DraftPage({ params, searchParams }: { params: { id: string }; searchParams: Search }) {
  if (params.id === 'new') return <GrownDraft searchParams={searchParams} />
  const draft = DRAFTS[params.id as keyof typeof DRAFTS]
  if (!draft) notFound()
  const parent = findSong(draft.parentSongId)
  const role = parent?.recruitment?.roles.find((r) => r.roleKindId === searchParams.sent)
  return (
    <ScreenFrame back={{ href: hrefSong(draft.parentSongId), label: '元の歌の画面へ' }}>
      <div data-screen="draft-participant">
        <h1 style={{ fontSize: 21, margin: 0 }}>{draft.title}</h1>
        <span className={s.mark}>
          <Icon name="join" size="s" />
          {draft.hostName}さんの制作に参加中
        </span>
        <h2 className={s.section}>あなたが送った物</h2>
        {role ? (
          <div className={s.row}>
            <span className={s.rowText}>
              <b>{role.roleLabel}_1</b>
              <span className={`${s.status}`}>
                <Icon name="clock" size="s" />
                送った物（まだこの歌には入っていません）
              </span>
            </span>
          </div>
        ) : (
          <p className={s.sub}>まだ送っていません。</p>
        )}
        <p className={s.sub}>主催が入れると「この歌に入りました」、入れなかったときは「今回は見送られました」と出ます。</p>
      </div>
    </ScreenFrame>
  )
}

function GrownDraft({ searchParams }: { searchParams: Search }) {
  const from = findSong(searchParams.from ?? '')
  if (!from) notFound()
  const take = (searchParams.take ?? '').split(',').filter(Boolean)
  const asked = (searchParams.ask ?? '').split(',').filter(Boolean)
  const add = ADD_OPTIONS.find((o) => o.id === searchParams.add)
  const nameOf = (id: string) => {
    const c = from.contributions.find((x) => x.id === id)
    return c ? `${c.holders.map((h) => `${h.displayName}さん`).join('・')}の${c.assetLabel}` : null
  }
  return (
    <ScreenFrame
      back={{ href: `${hrefSong(from.id)}/tree`, label: '生まれた流れへ' }}
      secondary={<UnavailableButton label="仲間を募集する" icon="join" reason="この画面では、まだ使えません（準備中）。" />}
    >
      <div data-screen="draft-grown">
        <div className={s.done} role="status">
          <span className={s.ring}>
            <Icon name="doc" size="l" />
          </span>
          <h1 style={{ fontSize: 21, margin: 0 }}>下書きに保存しました</h1>
          <p>まだ誰にも公開されていません。あなたが主催の新しい歌です。</p>
        </div>
        <dl className={s.kv}>
          <dt>元の歌</dt>
          <dd>{from.title}（元の歌は変わりません）</dd>
          <dt>受け継いだ物</dt>
          <dd>{take.map(nameOf).filter(Boolean).join('、') || 'なし'}</dd>
          {asked.length > 0 ? (
            <>
              <dt>お願い中</dt>
              <dd>{asked.map(nameOf).filter(Boolean).join('、')}（返事が来たら使えます）</dd>
            </>
          ) : null}
          <dt>あなたが加える物</dt>
          <dd>{add ? add.label : 'あとで決める'}</dd>
        </dl>
        <p className={s.sub}>役割は、あとから足したり、仲間を募集したりできます。</p>
      </div>
    </ScreenFrame>
  )
}
