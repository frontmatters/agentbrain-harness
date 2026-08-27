/** Package-owned invariant companion for AgentBrain commands. */
import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/agentbrain-commands'
export const name = 'agentbrain-commands-invariant'
export const inject = ['invariants']
/** No runtime invariant: command definitions are external AgentBrain files. */
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
