import React from 'react'
import { Icon } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { CONSENTS } from '@/lib/preview/sample'

// 対応待ち（M8）。公開する前の確認のお願いから、③ 届け方のステップへ着地する（Y1）。
export default function InboxPage() {
  const c = CONSENTS.ame
  return (
    <div style={{ padding: '12px 16px' }} data-screen="inbox">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>対応待ち</h1>
      <h2 className={s.section}>
        公開する前の確認のお願い <span className={s.badge}>1</span>
      </h2>
      <a className={s.row} href={`/ui/inbox/consent/${c.id}#step-3`} data-consent={c.id}>
        <span className={s.jacket}>
          <Icon name="doc" />
        </span>
        <span className={s.rowText}>
          <b>{c.title}</b>
          <span className={s.sub}>{c.hostName}さんから。あなたの名前・届け方を確認して、公開に同意してください</span>
        </span>
        <Icon name="right" size="s" />
      </a>
      <h2 className={s.section}>参加希望</h2>
      <p className={s.sub}>いまはありません</p>
      <h2 className={s.section}>送られた歌の確認</h2>
      <p className={s.sub}>いまはありません</p>
      <h2 className={s.section}>使わせてのお願い</h2>
      <p className={s.sub}>いまはありません</p>
    </div>
  )
}
