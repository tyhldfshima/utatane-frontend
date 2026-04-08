'use client'
export function NotificationBell() {
  return (
    <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" stroke="#374151" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 16a2 2 0 0 0 4 0" stroke="#374151" strokeWidth="1.5"/>
      </svg>
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
    </button>
  )
}