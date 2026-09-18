// lib/server/auth.ts — API の口での本人確認（TY JWT）
//
// ・@tyhld/auth の authenticateBearer で `Authorization: Bearer` の TY JWT を検証する（ES256・JWKS）。
// ・自前の認証（localStorage のトークン・独自 JWT）は使わない（D-4）。
// ・検証の設定（TY_JWKS_URL・TY_JWT_ISSUER・TY_JWT_AUDIENCE）の値はここに書かない。環境変数から読むだけ。
//   未設定なら 503 auth_not_configured（どこかの既定へ落とさない）。

import { authenticateBearer, InvalidTokenError } from '@tyhld/auth'
import type { Id } from '../domain/types'

export interface AuthVerifier {
  /** 本人の TY アカウント id を返す。トークンが無い・不正なら AuthFailure を投げる */
  verify(authorizationHeader: string | null): Promise<Id>
}

export class AuthFailure extends Error {
  constructor(public status: 401 | 503, public code: 'missing_token' | 'invalid_token' | 'auth_not_configured') {
    super(code)
  }
}

export function tyAuthVerifierFromEnv(env: Record<string, string | undefined> = process.env): AuthVerifier {
  return {
    async verify(header) {
      const jwksUrl = env.TY_JWKS_URL
      const issuer = env.TY_JWT_ISSUER
      const audience = env.TY_JWT_AUDIENCE ?? 'authenticated'
      if (!jwksUrl || !issuer) throw new AuthFailure(503, 'auth_not_configured')
      if (!header || !header.startsWith('Bearer ')) throw new AuthFailure(401, 'missing_token')
      try {
        const claims = await authenticateBearer(header, { jwksUrl, issuer, audience })
        return claims.ty_account_id
      } catch (e) {
        if (e instanceof InvalidTokenError) throw new AuthFailure(401, 'invalid_token')
        throw e
      }
    },
  }
}
