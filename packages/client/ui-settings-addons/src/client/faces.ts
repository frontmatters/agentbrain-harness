/** Shared inject faces and the bound-locale type for the AgentBrain section and its panels. */
import type { ManagedSkillInfo, SkillDetail, AddonInfo } from '@agentbrain-harness/api-remotes/client'
import type { PropsLocale } from '@agentbrain-harness/client-ui-slots'

/** The localized-text function bound to this section's dictionary namespace. */
export type SectionLocale = PropsLocale<'settings.agentBrainAddons'>['t']

/** Host addon operations the Addons panel consumes. */
export interface AgentBrainAddonsInjected {
  readonly list: () => Promise<AddonInfo[]>
  readonly enable: (id: string) => Promise<void>
  readonly disable: (id: string) => Promise<void>
  readonly check: (id: string) => Promise<{ ok: boolean; detail: string }>
  readonly test: (id: string) => Promise<{ ok: boolean; detail: string }>
}

/** Host skill operations the Skills panel consumes. */
export interface AgentBrainSkillsInjected {
  readonly listSkills: () => Promise<ManagedSkillInfo[]>
  readonly getSkill: (name: string) => Promise<SkillDetail | null>
  readonly setSkillEnabled: (name: string, enabled: boolean) => Promise<void>
}
