import React from 'react'
import styles from './ui.module.css'

// 線のアイコン（U-2・貢献の印と同じ体系：線の太さ 1.7・丸い端）。
// えふさん確定：絵文字は使わず、線のアイコンにそろえる。
const PATHS = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  inbox: <><path d="M4 13l2-8h12l2 8" /><path d="M4 13v6h16v-6h-5l-1 2h-4l-1-2z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  point: <><circle cx="12" cy="12" r="9" /><path d="M9.5 16.5V7.5h3.2a2.6 2.6 0 0 1 0 5.2H9.5" /></>,
  play: <path d="M8 5l11 7-11 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  heart: <path d="M12 20s-7-4.5-8.5-9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 4C19 15.5 12 20 12 20z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  tree: <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="12" r="2" /><path d="M6 7v10M6 12h4a6 6 0 0 0 6 0" /></>,
  seed: <><path d="M12 21v-8" /><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7z" /><path d="M12 15c0-3-2.5-5.5-6.5-5.5 0 3 2.5 5.5 6.5 5.5z" /><path d="M8 21h8" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  pen: <><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></>,
  note: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  wave: <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10" />,
  join: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2.5 20c.8-3 3-5 5.5-5s4 1.2 4.8 2.8M11.2 17.8c.8-1.6 2.3-2.8 4.8-2.8 2.5 0 4.7 2 5.5 5" /></>,
  branch: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="19" r="2" /><path d="M6 8c0 5 6 5 6 9M18 8c0 5-6 5-6 9" /></>,
  newVersion: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></>,
  send: <><path d="M4 12l16-8-6 16-2-6z" /><path d="M12 14l8-10" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  refresh: <><path d="M20 11a8 8 0 1 0-2 5.5" /><path d="M20 5v6h-6" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 13h16M12 9v11" /><path d="M12 9c-2-4-6-4-6-1s6 1 6 1c2-4 6-4 6-1s-6 1-6 1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  hand: <path d="M7 12V6a1.5 1.5 0 0 1 3 0v5M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7-3 0-5-2-6.5-4.5L3.8 13a1.5 1.5 0 0 1 2.6-1.5L7 12.5" />,
} as const

export type IconName = keyof typeof PATHS

export const ICON_NAMES = Object.keys(PATHS) as IconName[]

const SIZE = { s: 18, m: 22, l: 30 } as const

/** 飾りのアイコン。意味は必ず隣の文字で伝えるので、読み上げには出さない。 */
export function Icon({ name, size = 'm' }: { name: IconName; size?: keyof typeof SIZE }) {
  const px = SIZE[size]
  return (
    <svg
      className={styles.icon}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      aria-hidden="true"
      focusable="false"
      data-ui="icon"
      data-icon={name}
    >
      {PATHS[name]}
    </svg>
  )
}
