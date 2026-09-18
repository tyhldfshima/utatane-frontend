// lib/domain/types.ts — UTATANE の中核（Version／Contribution／Material／Permission・Consent）の型
//
// 置き場（DB・サーバ）に依存しない。設計の正本は docs/design/utatane-core-db-api-v1.md。
// 役割・由来の種類・素材の出どころの種類は固定の一覧にせず、文字列の id で持つ（種類の表で後から足す）。

export type Id = string
/** ISO 8601 の日時。比べるときは文字列のまま並べられる形（UTC の Z 付き）で持つ */
export type Timestamp = string

// ── 権利者（アカウントとは別の持ち物） ─────────────────────────

/** 権利の持ち主。アカウントが無くても存在できる（承継した人など） */
export interface RightsHolder {
  id: Id
  /** TY アカウント。無い場合は null */
  tyAccountId: Id | null
}

/** アカウント状態（退会・死亡の届出でも、権利状態は変わらない） */
export type AccountState = 'active' | 'withdrawn' | 'suspended' | 'unreachable' | 'death_reported'

// ── 役割（貢献の種類） ─────────────────────────────────────

/** 性質。役割の行ごとに持つ（③の権利整理の手掛かりで、判断ではない） */
export type RoleNature = 'work' | 'performance' | 'recording' | 'finishing'

export interface RoleKind {
  id: Id // 例: 'lyrics' 'melody' 'arrangement' 'vocal' 'guitar' 'recording' 'mix' …（行で足す）
  nature: RoleNature
}

// ── 貢献と由来 ────────────────────────────────────────────

export interface Contribution {
  id: Id
  roleKindId: Id
  /** 作者（1人以上）。共作なら複数 */
  holderIds: Id[]
  /** この貢献が生まれた Version */
  birthVersionId: Id
  /** 生まれた Version の公開日時（未公開なら null）。由来は時間の順にしか張れない */
  createdAt: Timestamp
}

/** 由来の矢印の種類。'modified_from'＝改変元／'based_on'＝基にした元（増やせる） */
export type DerivationKind = 'modified_from' | 'based_on' | (string & {})

/** 貢献どうしの由来（子 → 親）。全世代たどれる形で持ち、世代の数はデータに入れない */
export interface Derivation {
  childId: Id
  parentId: Id
  kind: DerivationKind
}

// ── 素材 ──────────────────────────────────────────────────

/** 出どころの申告（持ち込み素材は必須）。種類は増やせる */
export type ProvenanceKind =
  | 'self_made'
  | 'co_made'
  | 'licensed'
  | 'from_utatane_material'
  | 'external_material'
  | 'includes_ai'
  | (string & {})

export interface ProvenanceDeclaration {
  kind: ProvenanceKind
  declaredBy: Id
  declaredAt: Timestamp
  /** UTATANE 内の素材から作った場合の元の素材 */
  sourceMaterialId?: Id
  /** 根拠（許諾の書面の file id・出典・説明など）。中身の形は種類ごと */
  evidence?: Record<string, unknown>
}

export interface Material {
  id: Id
  /** 中央の保管サービスの file id */
  storageFileId: Id
  /** この素材が収めている貢献（例：伴奏の音声＝曲・編曲・演奏・録音） */
  embodiedContributionIds: Id[]
  /** 出どころの申告。持ち込み素材で無いものは Version に入れられない */
  provenance: ProvenanceDeclaration | null
}

// ── 再利用ポリシー（貢献の現在の設定・版つき） ────────────────────

export type ReuseMode = 'free' | 'approval' | 'forbidden'
export type ReuseScope = 'any_version' | 'this_version_only' | 'named_holders'

export interface ReusePolicyVersion {
  contributionId: Id
  /** 共作で作者ごとに希望が違うときの作者。null＝作者全員に同じ設定 */
  holderId: Id | null
  versionNo: number
  mode: ReuseMode
  scope: ReuseScope
  /** scope が named_holders のときだけ使う */
  namedHolderIds?: Id[]
  effectiveAt: Timestamp
}

/** 初期値は「申請→承認」（確定4） */
export const DEFAULT_REUSE_MODE: ReuseMode = 'approval'

// ── 共作の承認方式 ─────────────────────────────────────────

/** 「どちらか1人の承認」は持たない（追補3 #3） */
export type CoauthorApprovalMethod =
  | { kind: 'all' }
  | {
      kind: 'delegated'
      delegateHolderId: Id
      /** 委任した人ごとの同意の記録の有無（全員の委任がそろって初めて有効） */
      delegatedBy: Id[]
    }

// ── 個別に成立した許諾（Permission/Consent） ─────────────────────

export type PermissionBasis =
  | 'request_approval' // 申請への承認
  | 'recruitment_preapproval' // 募集の事前承認
  | 'policy_free' // 成立時のポリシーが「自由」
  | 'delegated_approval' // 委任に基づく代表者の承認

export interface PermissionEvent {
  kind: 'granted' | 'revoked' | 'kept_on_policy_change' | 'revoked_on_policy_change'
  actorHolderId: Id | null
  at: Timestamp
}

export interface Permission {
  id: Id
  contributionId: Id
  /** 許可を受けた人（利用する人） */
  granteeHolderId: Id
  /** どの派生について（下書きの Version） */
  draftVersionId: Id
  basis: PermissionBasis
  /** 許可した権利者（共作なら全員、または委任を受けた代表者） */
  grantorHolderIds: Id[]
  policyVersionNoAtGrant: number
  permissionRuleVersionAtGrant: number
  /** 状態の履歴（消さない・追記だけ） */
  events: PermissionEvent[]
}

// ── 許諾ルール（版つき） ────────────────────────────────────

/**
 * 許諾ルール。
 * R1：公開時点で有効な許諾が必須（初期商品ルール・確定）。
 * R2：公開前にポリシーが厳しくなったとき、成立済みの許諾が失効するか。値は未確定（追補3 AD-1）。
 *   'undecided' の間は安全側＝許可した人の選択の記録（残す／取り消す）が無ければ不通過。
 */
export interface PermissionRule {
  version: number
  r2OnPolicyTightened: 'undecided' | 'survives' | 'expires' | 'grantor_chooses'
}

export const INITIAL_PERMISSION_RULE: PermissionRule = {
  version: 1,
  r2OnPolicyTightened: 'undecided',
}

// ── Version と履歴つきの新版 ───────────────────────────────────

export type VersionContributionRelation = 'created' | 'referenced'

export interface VersionContribution {
  contributionId: Id
  relation: VersionContributionRelation
}

export interface Version {
  id: Id
  hostHolderId: Id
  /** 公開済みなら中身（貢献・素材）は書き換えない（確定3） */
  publishedAt: Timestamp | null
  contributions: VersionContribution[]
  /** この Version が使う素材 */
  materialIds: Id[]
}

export type PublicationState = 'public' | 'private' | 'anonymized' | 'suspended'

/** 履歴つきの新版の1行（公開状態・Revenue Rule の版など） */
export interface HistoryEntry<T> {
  seq: number
  value: T
  effectiveFrom: Timestamp
  recordedBy: Id
  reason: string
}
