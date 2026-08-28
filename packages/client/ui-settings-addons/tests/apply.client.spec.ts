/** AgentBrain settings section registration: nav-entry declaration, the locale-following label, and the injected host faces. */
import { Context, Service } from '@agentbrain-harness/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@agentbrain-harness/client-ui-slots'
import { SlotRegistry } from '@agentbrain-harness/client-runtime/client'
import { LocaleRuntime } from '@agentbrain-harness/client-locale/client'
import { apply, inject } from '@agentbrain-harness/client-ui-settings-addons/client'
import type { AgentBrainSectionInjected } from '../src/client/AgentBrainSettingsSection.tsx'

type RemoteAnswer<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
const ok = <T>(value: T): Promise<RemoteAnswer<T>> => Promise.resolve({ ok: true, value })

/** A remote namespace double whose methods return the carrier's ok/error envelope. */
function remoteStub(overrides: Record<string, (...args: never[]) => Promise<RemoteAnswer<unknown>>> = {}) {
  return {
    list: vi.fn(() => ok({ addons: [] })),
    enable: vi.fn(() => ok({ id: 'x', enabled: true })),
    disable: vi.fn(() => ok({ id: 'x', enabled: false })),
    check: vi.fn(() => ok({ id: 'x', ok: true, detail: 'fine' })),
    test: vi.fn(() => ok({ id: 'x', ok: true, detail: 'passed' })),
    listSkills: vi.fn(() => ok({ skills: [{ name: 's', description: 'd', whenToUse: null, provider: 'agentbrain', enabled: true }] })),
    getSkill: vi.fn(() => ok({ name: 's', description: 'd', whenToUse: null, provider: 'agentbrain', content: '# body', tags: [] })),
    setSkillEnabled: vi.fn(() => ok({ name: 's', enabled: false })),
    ...overrides,
  }
}

async function bench(remote = remoteStub()) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('nl')
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  ctx.provide('remote.agentbrainAddons', remote)
  const slots = ctx.get('slots') as SlotRegistry
  return { ctx, slots, locale, remote }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { 'settings.section': { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

function injectedFor(slots: SlotRegistry): AgentBrainSectionInjected {
  const entry = slots.entries('settings.section').find(candidate => candidate.options.id === 'agentbrain')!
  return (entry.inject as unknown as () => AgentBrainSectionInjected)()
}

describe('ui-settings-addons apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.agentbrainAddons'])
  })

  it('registers the AgentBrain nav entry with a locale-following label', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('settings.section').find(candidate => candidate.options.id === 'agentbrain')!
    expect(entry.options).toMatchObject({ id: 'agentbrain', order: 18 })
    expect(resolveSlotLabel(entry.options.label)).toBe('AgentBrain')
    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('AgentBrain')
  })

  it('registers the nl/en dictionaries and disposes them with the fiber', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.locale.bind('settings.agentBrainAddons')('addonsTab')).toBe('Addons')
    await fiber.dispose()
    expect(() => b.locale.register('settings.agentBrainAddons', 'nl', {})).not.toThrow()
    expect(() => b.locale.register('settings.agentBrainAddons', 'en', {})).not.toThrow()
  })

  it('unwraps successful addon and skill operations', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const injected = injectedFor(b.slots)
    expect(await injected.list()).toEqual([])
    await injected.enable('x')
    await injected.disable('x')
    expect(b.remote.enable).toHaveBeenCalledWith('x')
    expect(b.remote.disable).toHaveBeenCalledWith('x')
    expect(await injected.check('x')).toMatchObject({ ok: true, detail: 'fine' })
    expect(await injected.test('x')).toMatchObject({ ok: true, detail: 'passed' })
    expect(await injected.listSkills()).toHaveLength(1)
    expect(await injected.getSkill('s')).toMatchObject({ name: 's', content: '# body' })
    await injected.setSkillEnabled('s', false)
    expect(b.remote.setSkillEnabled).toHaveBeenCalledWith('s', false)
  })

  it('throws a descriptive error when a remote call reports failure', async () => {
    const remote = remoteStub({ listSkills: vi.fn(() => Promise.resolve({ ok: false as const, error: { code: 'internal', message: 'boom' } })) })
    const b = await bench(remote)
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const injected = injectedFor(b.slots)
    await expect(injected.listSkills()).rejects.toThrow(/internal: boom/)
  })

  it('reports unknown codes when a failed result omits its error detail', async () => {
    const remote = remoteStub({ list: vi.fn(() => Promise.resolve({ ok: false as const, error: undefined as never })) })
    const b = await bench(remote)
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const injected = injectedFor(b.slots)
    await expect(injected.list()).rejects.toThrow(/unknown: unknown/)
  })
})
