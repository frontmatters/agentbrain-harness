import type { Branded } from '@agentbrain-harness/brand'

/** An addon identifier accepted by the addon command. */
export type AddonId = Branded<'AddonId'>

/** Addon source selected by the canonical addon registry. */
export type AddonSource = 'bundled' | 'local'
/** Addon enablement state. */
export type AddonState = 'available' | 'enabled'

/** Compatibility level declared by an addon manifest for one client. */
export type AddonSupport = 'full' | 'rules' | 'none' | 'unknown'

/** One skill shipped by an addon. */
export interface AddonSkillInfo {
  readonly name: string
  readonly description: string | null
}

/** One addon discovered from the canonical registry and local state. */
export interface AddonInfo {
  readonly id: AddonId
  readonly version: string | null
  readonly state: AddonState
  readonly source: AddonSource
  readonly name: string
  readonly privacy: string | null
  readonly os: string | null
  readonly command: string | null
  readonly hasSkill: boolean
  readonly skills: readonly AddonSkillInfo[]
  readonly support: Readonly<Record<string, AddonSupport>>
}

/** One skill visible to the global Host registry. */
export interface ManagedSkillInfo {
  readonly name: string
  readonly description: string
  readonly provider: string
  readonly enabled: boolean
}

/** Point-in-time skill inventory. */
export interface SkillInventorySnapshot {
  readonly skills: readonly ManagedSkillInfo[]
}

/** Point-in-time addon inventory. */
export interface AddonInventorySnapshot {
  readonly addons: readonly AddonInfo[]
}

/** Result of checking one enabled addon. */
export interface AddonCheckResult {
  readonly id: AddonId
  readonly ok: boolean
  readonly detail: string
}

/** Result of running an addon's declared test suite. */
export interface AddonTestResult {
  readonly id: AddonId
  readonly ok: boolean
  readonly detail: string
}

/** Result of changing addon enablement. */
export interface AddonMutationResult {
  readonly id: AddonId
  readonly enabled: boolean
}
