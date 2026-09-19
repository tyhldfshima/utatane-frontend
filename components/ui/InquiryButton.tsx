'use client'

import React from 'react'
import { SecondaryButton } from './Button'
import { startInquiry } from './inquiry'

/** ［この取引について問い合わせる］。取引の番号は画面にも住所にも出さず、端末の中で引き継ぐ。 */
export function InquiryButton({ transactionId, label = 'この取引について問い合わせる' }: { transactionId: string; label?: string }) {
  return (
    <SecondaryButton
      label={label}
      icon="info"
      onClick={() => {
        window.location.assign(startInquiry(transactionId, window.sessionStorage))
      }}
    />
  )
}
