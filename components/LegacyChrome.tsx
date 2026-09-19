'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

// 今までの画面の枠（上の帯・再生・下のメニュー）。
// 新しい画面（/ui と /dev）は自分の枠を持つので、今までの枠を重ねない。今までの画面は変えない。
export function isNewUiPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === '/ui' || pathname.startsWith('/ui/') || pathname === '/dev' || pathname.startsWith('/dev/')
}

export function LegacyChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (isNewUiPath(pathname)) return <>{children}</>
  return (
    <>
      {header}
      <div className="pt-14 pb-32">{children}</div>
      {footer}
    </>
  )
}
