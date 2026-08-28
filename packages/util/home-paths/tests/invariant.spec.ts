import { Context } from '@agentbrain-harness/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@agentbrain-harness/invariants'
import * as HomePathsInvariant from '../src/invariant.ts'

describe('home-paths invariant companion', () => {
  it('registers the package-owned empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(HomePathsInvariant)
    await expect(fiber.await()).resolves.toBeDefined()
    await fiber.dispose()
    await expect(ctx.plugin(HomePathsInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
