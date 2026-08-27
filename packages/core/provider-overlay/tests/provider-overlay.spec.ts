/** Provider display overlay seeded as the base layer of a real settings section. */

import { describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import * as providerOverlay from '../src/index.ts'
import { PROVIDER_OVERLAY_SETTINGS_NAMESPACE } from '../src/index.ts'
import { SettingsProvider } from '@agentbrain-harness/settings'
import type { SettingsNamespace } from '@agentbrain-harness/settings'

/** The smallest real provider: one in-memory document, always writable. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

const FLAGSHIP = {
  'openai-codex': { displayName: 'ChatGPT', logo: 'openai', order: 1 },
  anthropic: { displayName: 'Claude', logo: 'anthropic', order: 2 },
  xai: { displayName: 'Grok', logo: 'xai', order: 3 },
}

async function boot(config: providerOverlay.Config): Promise<{
  ctx: Context
  settingsFiber: Context['fiber']
}> {
  const ctx = new Context()
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber.await()
  await ctx.plugin(providerOverlay, config)
  return { ctx, settingsFiber }
}

describe('provider-overlay', () => {
  it('seeds the flagship display defaults as the section base', async () => {
    const bench = await boot({ providers: FLAGSHIP })
    expect(bench.ctx.settings.get(PROVIDER_OVERLAY_SETTINGS_NAMESPACE)).toEqual(FLAGSHIP)
    const descriptor = bench.ctx.settings.describe().find(entry => entry.ns === PROVIDER_OVERLAY_SETTINGS_NAMESPACE)
    expect(descriptor?.value).toEqual(FLAGSHIP)
    expect(descriptor?.base).toEqual(FLAGSHIP)
    await bench.ctx.fiber.dispose()
  })

  it('seeds an empty section when no default overlay is composed', async () => {
    const bench = await boot({})
    expect(bench.ctx.settings.get(PROVIDER_OVERLAY_SETTINGS_NAMESPACE)).toEqual({})
    await bench.ctx.fiber.dispose()
  })

  it('deep-merges the user layer over a composed default, keeping unset fields', async () => {
    const bench = await boot({ providers: FLAGSHIP })
    await bench.settingsFiber.ctx.settings.replace(PROVIDER_OVERLAY_SETTINGS_NAMESPACE, {
      'openai-codex': { displayName: 'My GPT', hidden: true },
    })
    const value = bench.ctx.settings.get(PROVIDER_OVERLAY_SETTINGS_NAMESPACE) as Record<string, unknown>
    // The user renamed and hid the provider; the shipped logo and order survive the merge.
    expect(value['openai-codex']).toEqual({ displayName: 'My GPT', logo: 'openai', order: 1, hidden: true })
    await bench.ctx.fiber.dispose()
  })

  it('applies without a settings provider mounted', async () => {
    const ctx = new Context()
    await ctx.plugin(providerOverlay, { providers: FLAGSHIP })
    expect(ctx.get('settings')).toBeUndefined()
    await ctx.fiber.dispose()
  })
})
