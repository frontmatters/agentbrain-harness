/** AgentBrain settings section registered as its own Web Settings navigation entry. */
import type {} from '@agentbrain-harness/client-locale/client'
import type { ClientContext } from '@agentbrain-harness/client-runtime/client'
import type {} from '@agentbrain-harness/client-ui-settings/client'
import type { AddonCheckResult, AddonInventorySnapshot, AddonTestResult, SkillDetail, SkillInventorySnapshot } from '@agentbrain-harness/api-remotes/client'
import { AgentBrainSettingsSection } from './AgentBrainSettingsSection.tsx'
import type { AgentBrainAddonsInjected, AgentBrainSkillsInjected } from './faces.ts'
import { en, nl, type AddonsLocaleKey } from './locales.ts'

export type { AgentBrainAddonsInjected } from './faces.ts'
export type { AgentBrainSettingsSectionProps } from './AgentBrainSettingsSection.tsx'
export type { AddonsLocaleKey } from './locales.ts'

declare module '@agentbrain-harness/client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.agentBrainAddons': AddonsLocaleKey }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.agentBrainAddons'
export const inject = ['slots', 'locale', 'remote', 'remote.agentbrainAddons']

type RemoteResult = { readonly ok: boolean; readonly value?: unknown; readonly error?: { readonly code: string; readonly message: string } }
function unwrap(result: unknown): unknown {
  const response = result as RemoteResult
  if (!response.ok) throw new Error(`agentbrainAddons request failed: ${response.error?.code ?? 'unknown'}: ${response.error?.message ?? 'unknown'}`)
  return response.value
}
/** Contribute the AgentBrain section to the Settings navigation. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { nl, en }), 'ui-settings-addons: dictionaries')
  const t = ctx.locale.bind(NS)
  const list: AgentBrainAddonsInjected['list'] = async () => (unwrap(await ctx.remote.agentbrainAddons.list()) as AddonInventorySnapshot).addons.slice()
  const operation = (method: 'enable' | 'disable'): AgentBrainAddonsInjected[typeof method] => async (id) => { unwrap(await ctx.remote.agentbrainAddons[method](id)) }
  const check: AgentBrainAddonsInjected['check'] = async id => unwrap(await ctx.remote.agentbrainAddons.check(id)) as AddonCheckResult
  const test: AgentBrainAddonsInjected['test'] = async id => unwrap(await ctx.remote.agentbrainAddons.test(id)) as AddonTestResult
  const listSkills: AgentBrainSkillsInjected['listSkills'] = async () => (unwrap(await ctx.remote.agentbrainAddons.listSkills()) as SkillInventorySnapshot).skills.slice()
  const getSkill: AgentBrainSkillsInjected['getSkill'] = async name => unwrap(await ctx.remote.agentbrainAddons.getSkill(name)) as SkillDetail | null
  const setSkillEnabled: AgentBrainSkillsInjected['setSkillEnabled'] = async (name, enabled) => { unwrap(await ctx.remote.agentbrainAddons.setSkillEnabled(name, enabled)) }
  // This package owns one Settings navigation entry: the AgentBrain section.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'agentbrain',
    order: 18,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ list, enable: operation('enable'), disable: operation('disable'), check, test, listSkills, getSkill, setSkillEnabled }),
  }, AgentBrainSettingsSection))
}
