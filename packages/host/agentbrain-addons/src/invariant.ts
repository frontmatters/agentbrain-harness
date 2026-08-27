/** Package-owned invariant companion. @module @agentbrain-harness/host-agentbrain-addons/invariant */
import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/host-agentbrain-addons'
/** Cordis companion plugin name. */
export const name = 'host-agentbrain-addons-invariant'
/** Service required before registering package ownership. */
export const inject = ['invariants']
/** No runtime invariant: the canonical addon script owns state and mutations. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
