import React from 'react'
import { Icon } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { uiData } from '@/lib/ui-data'

// 対応待ち（M8）。公開する前の確認のお願いから、③ 届け方のステップへ着地する（Y1）。
// 段と中身は読み口から来る（lib/ui-data）。
export default async function InboxPage() {
  const groups = await uiData().listInbox()
  return (
    <div style={{ padding: '12px 16px' }} data-screen="inbox">
      <h1 style={{ fontSize: 21, margin: '4px 0' }}>対応待ち</h1>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`inbox-${g.key}`}>
          <h2 className={s.section} id={`inbox-${g.key}`}>
            {g.title} {g.items.length > 0 ? <span className={s.badge}>{g.items.length}</span> : null}
          </h2>
          {g.items.length === 0 ? (
            <p className={s.sub}>いまはありません</p>
          ) : (
            g.items.map((item) => (
              <a key={item.id} className={s.row} href={item.href} data-consent={item.id}>
                <span className={s.jacket}>
                  <Icon name={item.icon} />
                </span>
                <span className={s.rowText}>
                  <b>{item.title}</b>
                  <span className={s.sub}>{item.note}</span>
                </span>
                <Icon name="right" size="s" />
              </a>
            ))
          )}
        </section>
      ))}
    </div>
  )
}
