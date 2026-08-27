/** Package-owned invariant companion for AgentBrain context. */
import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/agentbrain-context'
export const name = 'agentbrain-context-invariant'
export const inject = ['invariants']

/** No runtime invariant: context projection reads external AgentBrain notes and publishes a session message. */
const install: InvariantInstaller = () => {}

/** Register the package invariant companion. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
