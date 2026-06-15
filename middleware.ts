// middleware.ts — 完全メンテナンス画面（案B: 全アクセスを静的メンテ画面へ rewrite）
//
// 環境変数 MAINTENANCE_MODE が 'on' / '1' / 'true' のとき、全リクエストを
// /maintenance.html へ rewrite する（URLはそのまま・中身だけ差し替え）。
// 未設定 / 'off' のときは何もせず、既存LP・各ルートがそのまま通常動作する。
// → コードはフラグを読むだけ。実際のON/OFFは Vercel の env 追加＋再デプロイ（人間）。

import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE_PAGE = '/maintenance.html'

function isMaintenanceOn(): boolean {
  const v = (process.env.MAINTENANCE_MODE || '').trim().toLowerCase()
  return v === 'on' || v === '1' || v === 'true'
}

export function middleware(request: NextRequest) {
  // フラグ未設定/off → 通常動作（LP・全ルートをそのまま通す）
  if (!isMaintenanceOn()) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // メンテ画面自身は素通り（無限ループ防止。matcher でも除外済み・二重の保険）
  if (pathname === MAINTENANCE_PAGE) {
    return NextResponse.next()
  }

  // API はデータを見せないよう 503 を返す（Railway バックエンドへは通さない）
  if (pathname.startsWith('/api')) {
    return new NextResponse(
      JSON.stringify({ error: 'Service temporarily unavailable for maintenance.' }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '3600',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  // それ以外の全画面ルート（/ /login /feed /upload /wallet /notifications 等）を
  // メンテ画面へ rewrite。URL はそのままで、全URLで同じメンテ画面が出る。
  const url = request.nextUrl.clone()
  url.pathname = MAINTENANCE_PAGE
  const res = NextResponse.rewrite(url, { status: 503 })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const config = {
  // 静的アセット・画像最適化・favicon・メンテHTML 自身は除外（それ以外を全部覆う）
  matcher: ['/((?!_next/static|_next/image|favicon.ico|maintenance.html).*)'],
}
