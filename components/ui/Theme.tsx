import React from 'react'
import { CSS_VARS } from './tokens'
import styles from './ui.module.css'

/** 共通の見た目部品の色・文字・大きさの変数を置く枠。部品はこの中で使う。 */
export function UtataneTheme({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.theme} style={CSS_VARS as React.CSSProperties} data-ui="theme">
      {children}
    </div>
  )
}
