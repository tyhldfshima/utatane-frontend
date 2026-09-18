// app/auth/callback/route.ts — 中央ログイン（TY アカウント）の戻り口
// Cookie を載せた応答でそのまま転送する部品（@tyhld/auth/callback）を呼ぶだけ。
import { handleTyAuthCallback } from '@tyhld/auth/callback'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  return handleTyAuthCallback(request, {
    redirect: (url) => NextResponse.redirect(url),
  })
}
