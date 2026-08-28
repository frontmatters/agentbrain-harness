import { Context } from '@agentbrain-harness/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@agentbrain-harness/invariants'
import * as AgentbrainCommandsInvariant from '../src/invariant.ts'

describe('agentbrain-commands invariant companion', () => {
  it('registers the package-owned empty installer and supports idempotent re-registration', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(AgentbrainCommandsInvariant)
    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
    await expect(ctx.plugin(AgentbrainCommandsInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
