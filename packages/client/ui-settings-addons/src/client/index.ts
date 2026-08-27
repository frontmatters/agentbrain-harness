/** AgentBrain addon management tab registered into Web Settings. */
import type {} from '@agentbrain-harness/client-locale/client'
import type { ClientContext } from '@agentbrain-harness/client-runtime/client'
import type {} from '@agentbrain-harness/client-ui-settings/client'
import type { AddonCheckResult, AddonInventorySnapshot, AddonTestResult, SkillInventorySnapshot } from '@agentbrain-harness/api-remotes/client'
import { AgentBrainAddonsSettingsTab, type AgentBrainAddonsInjected } from './AgentBrainAddonsSettingsTab.tsx'
import { en, nl, type AddonsLocaleKey } from './locales.ts'

export type { AgentBrainAddonsInjected, AgentBrainAddonsSettingsTabProps } from './AgentBrainAddonsSettingsTab.tsx'
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
/** Contribute the addon management tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { nl, en }), 'ui-settings-addons: dictionaries')
  const t = ctx.locale.bind(NS)
  const list: AgentBrainAddonsInjected['list'] = async () => (unwrap(await ctx.remote.agentbrainAddons.list()) as AddonInventorySnapshot).addons.slice()
  const operation = (method: 'enable' | 'disable'): AgentBrainAddonsInjected[typeof method] => async (id) => { unwrap(await ctx.remote.agentbrainAddons[method](id)) }
  const check: AgentBrainAddonsInjected['check'] = async id => unwrap(await ctx.remote.agentbrainAddons.check(id)) as AddonCheckResult
  const test: AgentBrainAddonsInjected['test'] = async id => unwrap(await ctx.remote.agentbrainAddons.test(id)) as AddonTestResult
  const listSkills: AgentBrainAddonsInjected['listSkills'] = async () => (unwrap(await ctx.remote.agentbrainAddons.listSkills()) as SkillInventorySnapshot).skills.slice()
  const setSkillEnabled: AgentBrainAddonsInjected['setSkillEnabled'] = async (name, enabled) => { unwrap(await ctx.remote.agentbrainAddons.setSkillEnabled(name, enabled)) }
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({ name: 'settings.plugins.tab', id: 'agentBrainAddons', order: 20, label: () => t('tab'), locale: NS, inject: () => ({ list, enable: operation('enable'), disable: operation('disable'), check, test, listSkills, setSkillEnabled }) }, AgentBrainAddonsSettingsTab))
}
