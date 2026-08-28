import { Context } from '@agentbrain-harness/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@agentbrain-harness/invariants'
import * as AgentBrainContextInvariant from '../src/invariant.ts'

describe('agentbrain-context invariant companion', () => {
  it('registers the package-owned empty installer and returns a disposer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(AgentBrainContextInvariant)
    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
    await expect(ctx.plugin(AgentBrainContextInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
