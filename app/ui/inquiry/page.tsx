'use client'

import React, { useEffect, useState } from 'react'
import { ScreenFrame, StateView, takeInquiry, type InquiryHandoff } from '@/components/ui'
import s from '@/components/ui/shell.module.css'

// 取引についての問い合わせ（受け取る側）。
// ★引き継いだ取引の番号は画面に出さない。送る所（窓口）は次の便（仮の形）。
export default function InquiryPage() {
  const [handoff, setHandoff] = useState<InquiryHandoff | null | 'loading'>('loading')
  useEffect(() => {
    setHandoff(takeInquiry(window.sessionStorage))
  }, [])

  if (handoff === 'loading') {
    return (
      <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }} title="この取引について問い合わせる">
        <StateView kind="loading" />
      </ScreenFrame>
    )
  }
  if (!handoff) {
    return (
      <ScreenFrame back={{ href: '/ui', label: 'ホームへ' }} title="この取引について問い合わせる">
        <StateView kind="empty" message="問い合わせる取引が選ばれていません。取引の詳細から開き直してください。" />
      </ScreenFrame>
    )
  }
  return (
    <ScreenFrame
      back={{ href: '/ui', label: 'ホームへ' }}
      title="この取引について問い合わせる"
      primary={{ kind: 'unavailable', label: '送る', reason: '問い合わせの窓口は、まだ準備中です。' }}
    >
      <div data-screen="inquiry" data-has-handoff="true">
        <p>選んだ取引についてのお問い合わせです。取引の番号を書き写す必要はありません。</p>
        <label htmlFor="inquiry-text" className={s.section}>
          お問い合わせの内容
        </label>
        <textarea id="inquiry-text" className={s.textarea} />
      </div>
    </ScreenFrame>
  )
}
