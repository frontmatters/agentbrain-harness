/**
 * Ships default display metadata for the account-login providers as composition
 * data. The Models page and first-run onboarding render provider names, logos,
 * order, and visibility from the `ui-provider-overlay` settings section this
 * plugin seeds. No vendor name lives in this module: the defaults arrive through
 * config from the bundle, and the user's settings document overrides them per
 * provider id.
 *
 * @module @agentbrain-harness/provider-overlay
 */

import type { Context } from '@agentbrain-harness/cordis'
import z from '@agentbrain-harness/schemastery'
import { installSettingsSection, settingsNamespace } from '@agentbrain-harness/settings'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'provider-overlay'

/** Settings namespace the Models UI reads for per-provider display metadata. */
export const PROVIDER_OVERLAY_SETTINGS_NAMESPACE = settingsNamespace('ui-provider-overlay')

/** One provider's display overlay: rename, choose a logo, order, or hide. All fields optional. */
export interface ProviderOverlayEntry {
  /** Display name replacing the engine metadata name (e.g. "ChatGPT"). */
  displayName?: string
  /** Brand-mark id the client renders; absent renders a name monogram. */
  logo?: string
  /** Sort key; unset sorts after the ordered providers. */
  order?: number
  /** Hide this provider from the sign-in list. */
  hidden?: boolean
}

/** The overlay settings section: provider id to its display overlay. */
export type ProviderOverlaySettings = Record<string, ProviderOverlayEntry>

/** A fresh schema for one overlay entry; a factory keeps the two parents from sharing a node. */
function overlayEntrySchema(): z<ProviderOverlayEntry> {
  return z.object({
    displayName: z.string(),
    logo: z.string(),
    order: z.number(),
    hidden: z.boolean(),
  })
}

/** Schema of the overlay settings section: a provider-keyed dictionary of entries. */
export const PROVIDER_OVERLAY_SETTINGS_SCHEMA: z<ProviderOverlaySettings> = z.dict(overlayEntrySchema())

/**
 * Composition config: the default overlay. Vendor display names and logo ids
 * live here as data supplied by the bundle, never in this module's code. The
 * user's settings section overrides it per provider id.
 */
export interface Config {
  /** Default overlay keyed by provider id. */
  providers?: ProviderOverlaySettings
}

/** Schemastery validation for {@link Config}; an absent overlay defaults to empty. */
export const Config: z<Config> = z.object({
  providers: z.dict(overlayEntrySchema()).default({}),
})

/**
 * Register the overlay settings section with the config defaults as its base
 * layer, so `settings.describe()` surfaces the display metadata before the user
 * edits anything. The section has no host-side consumer; the client reads it
 * over the wire, so the section hooks are inert.
 * @param ctx - Cordis context carrying the settings capability.
 * @param config - the default overlay supplied by composition.
 */
export function apply(ctx: Context, config: Config): void {
  // The schema defaulted the overlay to `{}`, so providers is always present.
  const base = config.providers as ProviderOverlaySettings
  installSettingsSection(ctx, PROVIDER_OVERLAY_SETTINGS_NAMESPACE, PROVIDER_OVERLAY_SETTINGS_SCHEMA, base, {
    setSource: () => {},
    onChange: () => {},
  })
}
