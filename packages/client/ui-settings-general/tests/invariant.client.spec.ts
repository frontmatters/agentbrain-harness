import { describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import * as GeneralInvariant from '@agentbrain-harness/client-ui-settings-general/invariant'
import InvariantRegistry from '@agentbrain-harness/invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(GeneralInvariant).await()).resolves.toBeDefined()
  })
})
