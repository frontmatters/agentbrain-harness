/**
 * Package-owned invariant companion for the provider display overlay.
 *
 * The plugin owns no independent event relationship: it only seeds a settings
 * section whose registration validates every mutable value. The empty installer
 * keeps that absence explicit in composed invariant sets.
 *
 * @module @agentbrain-harness/provider-overlay/invariant
 */

import type { Context } from '@agentbrain-harness/cordis'
import type { InvariantInstaller } from '@agentbrain-harness/invariants'

const PACKAGE_NAME = '@agentbrain-harness/provider-overlay'

/** Cordis companion plugin name. */
export const name = 'provider-overlay-invariant'
/** Services required before the companion can register. */
export const inject = ['invariants']

/** No runtime invariant: settings validation owns the only mutable-value relationship. */
const install: InvariantInstaller = () => {}

/**
 * Register the intentionally empty invariant contribution.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
