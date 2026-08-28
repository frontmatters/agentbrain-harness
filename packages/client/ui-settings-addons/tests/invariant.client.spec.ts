import { describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import * as AddonsInvariant from '@agentbrain-harness/client-ui-settings-addons/invariant'
import InvariantRegistry from '@agentbrain-harness/invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(AddonsInvariant).await()).resolves.toBeDefined()
  })

  it('node-half apply is a no-op host placeholder', async () => {
    const { apply } = await import('@agentbrain-harness/client-ui-settings-addons')
    expect(() => { apply() }).not.toThrow()
  })
})
