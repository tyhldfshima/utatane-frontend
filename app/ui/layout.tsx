import React from 'react'
import type { Metadata } from 'next'
import { UtataneTheme } from '@/components/ui'
import { AppShell } from '@/components/ui/AppShell'

// 新しい画面（主要4導線と「自分」）。データは読み口（lib/ui-data）から来る。いまは見本の読み口。
export const metadata: Metadata = {
  title: 'UTATANE',
  robots: { index: false, follow: false },
}

export default function UiLayout({ children }: { children: React.ReactNode }) {
  return (
    <UtataneTheme>
      <AppShell sampleNote="見本のデータで表示しています（仮の形）">{children}</AppShell>
    </UtataneTheme>
  )
}
