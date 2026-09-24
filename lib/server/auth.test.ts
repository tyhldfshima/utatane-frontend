import { describe, expect, it, vi } from 'vitest'
import { AuthFailure, tyAuthVerifierFromEnv } from './auth'

// 中央の検証（JWKS を取りに行く）は試験では呼ばない：@tyhld/auth を差し替える（vi.mock は import より先に効く）
vi.mock('@tyhld/auth', () => {
  class InvalidTokenError extends Error {}
  return {
    InvalidTokenError,
    authenticateBearer: vi.fn(async (header: string) => {
      if (header === 'Bearer good') return { ty_account_id: 'acc-1' }
      throw new InvalidTokenError('bad')
    }),
  }
})

const env = { TY_JWKS_URL: 'https://example.invalid/jwks.json', TY_JWT_ISSUER: 'https://example.invalid/auth/v1' }

describe('TY JWT の本人確認（@tyhld/auth）', () => {
  it('設定が無ければ 503 auth_not_configured（既定の住所へ落とさない）', async () => {
    await expect(tyAuthVerifierFromEnv({}).verify('Bearer good')).rejects.toMatchObject({ status: 503, code: 'auth_not_configured' })
  })

  it('トークンが無ければ 401 missing_token', async () => {
    await expect(tyAuthVerifierFromEnv(env).verify(null)).rejects.toMatchObject({ status: 401, code: 'missing_token' })
    await expect(tyAuthVerifierFromEnv(env).verify('Basic xyz')).rejects.toBeInstanceOf(AuthFailure)
  })

  it('不正なトークンは 401 invalid_token、正しいトークンは TY アカウント id', async () => {
    await expect(tyAuthVerifierFromEnv(env).verify('Bearer bad')).rejects.toMatchObject({ status: 401, code: 'invalid_token' })
    await expect(tyAuthVerifierFromEnv(env).verify('Bearer good')).resolves.toBe('acc-1')
  })
})
