import React from 'react'
import { ScreenFrame, SecondaryButton, UnavailableButton } from '@/components/ui'
import s from '@/components/ui/shell.module.css'
import { uiData } from '@/lib/ui-data'

// ＋つくる（何から始めますか）。始め方は読み口から来る（lib/ui-data）。
// 進める始め方だけ href を持ち、まだ作っていない物は理由つきで押せない形にする。
export default async function CreatePage() {
  const options = await uiData().listCreateOptions()
  return (
    <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }} title="何から始めますか">
      <div data-screen="create">
        {options.map((o) =>
          o.href ? (
            <SecondaryButton key={o.id} label={o.label} icon={o.icon} href={o.href} />
          ) : (
            <UnavailableButton key={o.id} label={o.label} icon={o.icon} reason={o.reason ?? 'この始め方は、まだ準備中です。'} />
          ),
        )}
        <p className={s.sub}>今ある歌の「この歌が生まれた流れ」から、新しい Version として育てられます。</p>
      </div>
    </ScreenFrame>
  )
}
