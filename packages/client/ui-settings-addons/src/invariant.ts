/** Package-owned invariant companion. */
import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/client-ui-settings-addons'
export const name = 'client-ui-settings-addons-invariant'
export const inject = ['invariants']
/** No runtime invariant: this package owns a settings-only browser contribution. */
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
