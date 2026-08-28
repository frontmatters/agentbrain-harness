import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Plugin } from '@agentbrain-harness/cordis'
import Loader from '@agentbrain-harness/cordis-plugin-loader'
import { remoteMethods } from '@agentbrain-harness/typert-protocol'
import PluginInventoryGateway from '../src/index.ts'
import { readPatchList } from '../src/patch-file.ts'

const contexts: Context[] = []
const dirs: string[] = []
const savedHome = process.env.ABH_HOME

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  if (savedHome === undefined) delete process.env.ABH_HOME
  else process.env.ABH_HOME = savedHome
})

const activePlugin: Plugin.Function = () => {}
const pendingPlugin: Plugin.Object = {
  inject: ['neverReady'],
  apply() {},
}

async function harness(togglable: string[] = []): Promise<{
  ctx: Context
  inventory: PluginInventoryGateway
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  ctx.loader.builtins.active = activePlugin
  ctx.loader.builtins.pending = pendingPlugin
  await ctx.plugin(PluginInventoryGateway, { togglable })
  const inventory = ctx.get('pluginInventory') as PluginInventoryGateway
  return { ctx, inventory }
}

/** Point ABH_HOME at a throwaway directory so the toggle write lands there. */
async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'abh-home-'))
  dirs.push(dir)
  process.env.ABH_HOME = dir
  return dir
}

describe('PluginInventoryGateway', () => {
  it('publishes the list and setEnabled methods under the pluginInventory namespace', async () => {
    const { inventory } = await harness()
    expect(inventory.typertRemote).toMatchObject({
      serviceKey: 'pluginInventory',
      namespace: 'pluginInventory',
    })
    expect(remoteMethods(inventory)).toEqual(expect.arrayContaining([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'setEnabled', invocation: { kind: 'direct' } },
    ]))
  })

  it('projects current non-group Loader entries without a second cache', async () => {
    const { ctx, inventory } = await harness()
    const activeId = await ctx.loader.create({ name: 'cordis:active' })
    const pendingId = await ctx.loader.create({ name: 'cordis:pending' })
    const disabledId = await ctx.loader.create({
      name: 'cordis:not-installed',
      disabled: true,
    })
    await ctx.loader.create({ name: 'cordis:active', group: true })

    const snapshot = inventory.list()
    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      { entryId: activeId, moduleName: 'cordis:active', enabled: true, fiberPhase: 'active', togglable: false },
      { entryId: pendingId, moduleName: 'cordis:pending', enabled: true, fiberPhase: 'pending', togglable: false },
      { entryId: disabledId, moduleName: 'cordis:not-installed', enabled: false, fiberPhase: null, togglable: false },
    ]))

    await ctx.loader.update(activeId, { disabled: true })
    expect(inventory.list().entries.find(entry => entry.entryId === activeId)).toEqual({
      entryId: activeId, moduleName: 'cordis:active', enabled: false, fiberPhase: null, togglable: false,
    })

    await ctx.loader.remove(pendingId)
    expect(inventory.list().entries.some(entry => entry.entryId === pendingId)).toBe(false)
  })

  it('marks only allowlisted entries togglable', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Loader)
    ctx.loader.builtins.active = activePlugin
    const openId = await ctx.loader.create({ name: 'cordis:active' })
    const lockedId = await ctx.loader.create({ name: 'cordis:active' })
    await ctx.plugin(PluginInventoryGateway, { togglable: [openId] })
    const inventory = ctx.get('pluginInventory') as PluginInventoryGateway
    const byId = new Map<string, boolean>(inventory.list().entries.map(entry => [entry.entryId, entry.togglable]))
    expect(byId.get(openId)).toBe(true)
    expect(byId.get(lockedId)).toBe(false)
  })

  it('writes an allowlisted disable to the home patch layer', async () => {
    const home = await tempHome()
    const { inventory } = await harness(['some-plugin'])
    const result = await inventory.setEnabled('some-plugin' as never, false)
    expect(result).toEqual({ entryId: 'some-plugin', enabled: false })
    expect(await readPatchList(join(home, 'cordis.patch.yml'))).toEqual([{ id: 'some-plugin', disabled: true }])
  })

  it('targets the include-relative id when toggling a prefixed tree entry', async () => {
    const home = await tempHome()
    const { inventory } = await harness(['ui-goal'])
    const result = await inventory.setEnabled('include:ui-goal' as never, false)
    expect(result).toEqual({ entryId: 'include:ui-goal', enabled: false })
    expect(await readPatchList(join(home, 'cordis.patch.yml'))).toEqual([{ id: 'ui-goal', disabled: true }])
  })

  it('refuses to toggle an entry outside the allowlist', async () => {
    await tempHome()
    const { inventory } = await harness([])
    await expect(inventory.setEnabled('core-plugin' as never, false)).rejects.toThrow('not user-togglable')
  })
})
