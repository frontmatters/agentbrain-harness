/** Package-owned invariant companion for AgentBrain memory. */
import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/agentbrain-memory'
export const name = 'agentbrain-memory-invariant'
export const inject = ['invariants']

/** No runtime invariant: memory files are external durable data owned by the vault. */
const install: InvariantInstaller = () => {}

/** Register the package invariant companion. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
