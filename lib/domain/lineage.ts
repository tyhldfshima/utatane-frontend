// lib/domain/lineage.ts — 由来（Version Graph）のたどり方
//
// ・由来は全世代たどる。何世代まで報酬の対象にするかはここでは決めない（Revenue Rule が決める）。
// ・貢献は一意に扱う（系譜・数には1回だけ出す）。ただし「どの道で当たったか」は全部残す
//   （道ごとに数えるか1回にまとめるかは Revenue Rule が決める：追補2 26-2）。
// ・矢印は時間の順にしか張れない。輪ができる矢印は足せない。

import type { Contribution, Derivation, Id, Material, Version } from './types'

/** Version からある貢献に当たった1本の道 */
export interface LineagePath {
  /** 最初の一歩：Version が直接参照したか、素材が収めていたか */
  via: 'direct' | 'material'
  materialId?: Id
  /** 使われた貢献から、たどり着いた貢献までの並び（先頭＝使われた貢献） */
  chain: Id[]
}

export interface LineageEntry {
  contributionId: Id
  /** いちばん近い道での世代（0＝その Version が使った貢献そのもの） */
  generation: number
  paths: LineagePath[]
}

function parentsOf(derivations: Derivation[]): Map<Id, Derivation[]> {
  const m = new Map<Id, Derivation[]>()
  for (const d of derivations) {
    const list = m.get(d.childId)
    if (list) list.push(d)
    else m.set(d.childId, [d])
  }
  return m
}

/**
 * Version が使う貢献の集合（直接の参照＋使う素材が収める貢献）。
 * 素材を使うには、素材が収める全ての貢献の条件がそろう必要がある（追補2 27章）ため、ここで全部を拾う。
 */
export function requiredContributionsOf(
  version: Version,
  materials: Map<Id, Material>,
): Map<Id, LineagePath[]> {
  const out = new Map<Id, LineagePath[]>()
  const add = (id: Id, p: LineagePath) => {
    const list = out.get(id)
    if (list) list.push(p)
    else out.set(id, [p])
  }
  for (const vc of version.contributions) {
    add(vc.contributionId, { via: 'direct', chain: [vc.contributionId] })
  }
  for (const mid of version.materialIds) {
    const m = materials.get(mid)
    if (!m) throw new Error(`material_not_found:${mid}`)
    for (const cid of m.embodiedContributionIds) {
      add(cid, { via: 'material', materialId: mid, chain: [cid] })
    }
  }
  return out
}

/**
 * Version の由来を全世代たどる。
 * 戻り値は貢献ごとに1件（一意）。同じ貢献に複数の道で当たった場合は paths に全部並ぶ。
 * 万一データに輪があっても止まるよう、道の中で同じ貢献を2度通らない。
 */
export function traceVersionLineage(
  version: Version,
  materials: Map<Id, Material>,
  derivations: Derivation[],
): LineageEntry[] {
  const parents = parentsOf(derivations)
  const entries = new Map<Id, LineageEntry>()

  const visit = (id: Id, path: LineagePath) => {
    const generation = path.chain.length - 1
    const e = entries.get(id)
    if (e) {
      e.paths.push(path)
      if (generation < e.generation) e.generation = generation
    } else {
      entries.set(id, { contributionId: id, generation, paths: [path] })
    }
    for (const d of parents.get(id) ?? []) {
      if (path.chain.includes(d.parentId)) continue // 輪の守り
      visit(d.parentId, { ...path, chain: [...path.chain, d.parentId] })
    }
  }

  requiredContributionsOf(version, materials).forEach((paths, cid) => {
    for (const p of paths) visit(cid, p)
  })
  return Array.from(entries.values())
}

/** ancestorId が id の由来（全世代）に含まれるか */
export function isAncestor(derivations: Derivation[], id: Id, ancestorId: Id): boolean {
  const parents = parentsOf(derivations)
  const seen = new Set<Id>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop() as Id
    for (const d of parents.get(cur) ?? []) {
      if (d.parentId === ancestorId) return true
      if (!seen.has(d.parentId)) {
        seen.add(d.parentId)
        stack.push(d.parentId)
      }
    }
  }
  return false
}

export type DerivationCheck =
  | { ok: true }
  | { ok: false; reason: 'self_reference' | 'not_earlier' | 'would_create_cycle' }

/**
 * 由来の矢印（child は parent を元にした）を足してよいか。
 * ・親は子より先に生まれていること（時間の順）
 * ・足すと輪になる矢印は足さない（子が既に親の由来に入っていないこと）
 */
export function canAddDerivation(
  derivations: Derivation[],
  child: Contribution,
  parent: Contribution,
): DerivationCheck {
  if (child.id === parent.id) return { ok: false, reason: 'self_reference' }
  if (!(parent.createdAt < child.createdAt)) return { ok: false, reason: 'not_earlier' }
  if (isAncestor(derivations, parent.id, child.id)) return { ok: false, reason: 'would_create_cycle' }
  return { ok: true }
}
