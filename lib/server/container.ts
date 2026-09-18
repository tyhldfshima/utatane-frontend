// lib/server/container.ts — API の口が使う部品の置き場
//
// ★保存はいまメモリ（MemoryRepository）。専用 DB ができたら、ここで Supabase 版の保存に差し替える（1か所）。
// ★メモリの保存はサーバの再起動で消える。本番はメンテナンス表示中で使われない。

import { beneficiaryRegistryNotConfigured } from '../integrations/typ'
import { tyAuthVerifierFromEnv, type AuthVerifier } from './auth'
import { CoreService } from './core-service'
import { MemoryRepository } from './memory-repository'

interface Container {
  service: CoreService
  auth: AuthVerifier
}

let current: Container | null = null

export function getContainer(): Container {
  if (!current) {
    current = {
      service: new CoreService({ repo: new MemoryRepository(), beneficiaries: beneficiaryRegistryNotConfigured }),
      auth: tyAuthVerifierFromEnv(),
    }
  }
  return current
}

/** 試験用：部品を差し替える */
export function setContainerForTesting(c: Container | null) {
  current = c
}
