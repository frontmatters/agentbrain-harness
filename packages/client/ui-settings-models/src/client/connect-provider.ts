/**
 * OAuth provider connection helpers for the Models settings section. The probe
 * and connect helpers mirror the shape of the local-runtime helpers: each is a
 * thin, testable wrapper over one wire method so the component only manages
 * state.
 *
 * @module @agentbrain-harness/client-ui-settings-models/connect-provider
 */

import type { IApiClient, SettingsPathOpView } from '@agentbrain-harness/api-remotes/client'
import { mutateNamespace } from './settings-mutate.ts'
import type { MutateNamespaceResult, SettingsMutateFace } from './settings-mutate.ts'
import { PI_AI_NAMESPACE } from './local-runtime.ts'

/**
 * The settings namespace holding the per-provider display overlay. It ships
 * defaults and the user can override it, so display names and logos are config,
 * never a vendor list in this code.
 */
export const PROVIDER_OVERLAY_NAMESPACE = 'ui-provider-overlay'

/** One overlay entry: rename, choose a logo, order, or hide a provider. All optional. */
export interface ProviderOverlayEntry {
  /** Display name that replaces the host metadata name (e.g. "ChatGPT"). */
  displayName?: string
  /** Brand-mark id for {@link ProviderMark}; absent renders a monogram. */
  logo?: string
  /** Sort key; unset sorts after the ordered providers. */
  order?: number
  /** Hide this provider from the sign-in list. */
  hidden?: boolean
}

/** A connectable account provider resolved for rendering. */
export interface OAuthProvider {
  /** The pi-ai provider id (credential-record and route key). */
  id: string
  /** Display name: the overlay's rename, else the host metadata name. */
  name: string
  /** Brand-mark id from the overlay; absent means a name monogram. */
  logo?: string
}

/**
 * Fetch the oauth-capable account providers the host can drive. The host filters
 * its authorization registry to oauth flows; this returns an empty list on any
 * failure so the surface degrades to the API-key and local paths.
 * @param oauth - the oauth wire face carrying providers.
 * @returns the providers with their host metadata names.
 */
export async function fetchOAuthProviders(
  oauth: Pick<IApiClient['oauth'], 'providers'>,
): Promise<readonly { id: string; name: string }[]> {
  try {
    const response = await oauth.providers({})
    return response.result.ok ? response.result.value.providers : []
  } catch {
    // A rejected transport means the host is unreachable; the caller shows the
    // other connect paths rather than surfacing a fetch error.
    return []
  }
}

/**
 * Read the provider display overlay from settings. Returns an empty overlay on
 * any failure, leaving each provider with its host metadata name and a monogram.
 * @param settings - the settings wire face carrying describe.
 * @returns the overlay map keyed by provider id.
 */
export async function readProviderOverlay(
  settings: Pick<IApiClient['settings'], 'describe'>,
): Promise<Readonly<Record<string, ProviderOverlayEntry>>> {
  try {
    const response = await settings.describe({})
    if (!response.result.ok) return {}
    const view = response.result.value.namespaces.find(namespace => namespace.ns === PROVIDER_OVERLAY_NAMESPACE)
    return view === undefined ? {} : view.value as Record<string, ProviderOverlayEntry>
  } catch {
    return {}
  }
}

/**
 * Merge the host provider list with the display overlay: hide, rename, choose a
 * logo, and order. A provider absent from the overlay keeps its metadata name,
 * carries no logo (a monogram renders), and sorts after the ordered ones.
 * @param providers - the host provider list.
 * @param overlay - the display overlay keyed by provider id.
 * @returns the resolved, ordered, non-hidden providers.
 */
export function applyProviderOverlay(
  providers: readonly { id: string; name: string }[],
  overlay: Readonly<Record<string, ProviderOverlayEntry>>,
): OAuthProvider[] {
  const order = (id: string): number => overlay[id]?.order ?? Number.MAX_SAFE_INTEGER
  return providers
    .filter(provider => overlay[provider.id]?.hidden !== true)
    .map((provider) => {
      const entry = overlay[provider.id]
      return {
        id: provider.id,
        name: entry?.displayName ?? provider.name,
        ...entry?.logo === undefined ? {} : { logo: entry.logo },
      }
    })
    .sort((left, right) => order(left.id) - order(right.id))
}

/**
 * Probe a provider's OAuth connection state without exposing any credential.
 * Returns `{ connected: false }` when the wire call fails, so callers treat
 * an unreachable host the same as a disconnected provider.
 * @param oauth - the oauth wire face carrying status.
 * @param id - the pi-ai provider id to probe.
 * @returns the provider's connection state.
 */
export async function probeOAuthStatus(
  oauth: Pick<IApiClient['oauth'], 'status'>,
  id: string,
): Promise<{ connected: boolean; type?: string }> {
  try {
    const response = await oauth.status({ providerId: id })
    if (!response.result.ok) return { connected: false }
    return response.result.value
  } catch {
    // A rejected transport means the host is unreachable; the caller falls
    // back to the not-connected state rather than surfacing a probe error.
    return { connected: false }
  }
}

/**
 * Start the OAuth login flow for a provider. Returns the authorization URL
 * the caller must open for the user to complete the flow.
 * @param oauth - the oauth wire face carrying begin.
 * @param id - the pi-ai provider id to connect.
 * @returns the authorization URL and an optional device code.
 */
export async function beginConnect(
  oauth: Pick<IApiClient['oauth'], 'begin'>,
  id: string,
): Promise<{ authUrl: string; code?: string }> {
  const response = await oauth.begin({ providerId: id })
  if (!response.result.ok) throw new Error(response.result.error.message)
  return response.result.value
}

/**
 * Provision a catalog route for a connected OAuth provider so its models appear
 * in the picker and resolve as a default. A signed-in provider is directory-
 * visible but the adapter only mounts routes named in settings, so connecting
 * must write the route. A catalog route carries only a display name; the
 * credential comes from the OAuth store, so it needs no `apiKeyEnv`.
 * @param settings - the settings wire face (describe + mutate).
 * @param id - the pi-ai provider id (also the route key).
 * @param displayName - the human-facing route name.
 * @returns whether the write landed, with a reason when it did not.
 */
export async function writeOAuthProviderRoute(
  settings: SettingsMutateFace,
  id: string,
  displayName: string,
): Promise<MutateNamespaceResult> {
  const ops: SettingsPathOpView[] = [{ op: 'set', path: ['providers', id], value: { displayName } }]
  return mutateNamespace(settings, PI_AI_NAMESPACE, ops)
}

/**
 * Discover the first model a provider route serves, for a default-model choice.
 * Returns undefined when discovery fails or the route lists no models, so the
 * caller can still finish connecting and let the user pick a model later.
 * @param llm - the llm wire face carrying discoverModels.
 * @param id - the pi-ai provider id whose route was just written.
 * @returns the first model id, or undefined.
 */
export async function firstModelForProvider(
  llm: Pick<IApiClient['llm'], 'discoverModels'>,
  id: string,
): Promise<string | undefined> {
  try {
    const response = await llm.discoverModels({ settingsNs: PI_AI_NAMESPACE, provider: id })
    if (!response.result.ok) return undefined
    return response.result.value.models[0]?.id
  } catch {
    return undefined
  }
}

/** State callbacks a connect flow drives; `onAuthUrl` is optional for surfaces that do not show the URL. */
export interface OAuthConnectHandlers {
  /** The flow has started and the auth URL is being requested. */
  onConnecting: () => void
  /** The authorization URL is available (before it is opened), with an optional device code. */
  onAuthUrl?: (url: string, code?: string) => void
  /** A status poll observed the credential landed. */
  onConnected: () => void
  /** The begin call failed, or polling reached its cap. */
  onError: () => void
}

/**
 * Run the OAuth connect flow: begin, open the authorization URL in a new tab,
 * then poll status every ~1500 ms until connected or the ~2 min cap (80 polls).
 * Shared by the Models connect row and first-run onboarding.
 * @param oauth - the oauth wire face carrying begin and status.
 * @param id - the pi-ai provider id to connect.
 * @param handlers - state callbacks for each phase transition.
 */
export function runOAuthConnect(
  oauth: Pick<IApiClient['oauth'], 'begin' | 'status'>,
  id: string,
  handlers: OAuthConnectHandlers,
): void {
  handlers.onConnecting()
  void beginConnect(oauth, id)
    .then((result) => {
      if (result.code === undefined) handlers.onAuthUrl?.(result.authUrl)
      else handlers.onAuthUrl?.(result.authUrl, result.code)
      window.open(result.authUrl, '_blank', 'noopener')
      let attempts = 0
      const MAX_ATTEMPTS = 80
      const poll = (): void => {
        attempts++
        void probeOAuthStatus(oauth, id).then((status) => {
          if (status.connected) { handlers.onConnected(); return }
          if (attempts >= MAX_ATTEMPTS) { handlers.onError(); return }
          setTimeout(poll, 1500)
        })
      }
      setTimeout(poll, 1500)
    })
    .catch(() => { handlers.onError() })
}

/**
 * Remove the stored OAuth credential for a provider (disconnect / log out).
 * @param oauth - the oauth wire face carrying logout.
 * @param id - the pi-ai provider id to disconnect.
 */
export async function disconnect(
  oauth: Pick<IApiClient['oauth'], 'logout'>,
  id: string,
): Promise<void> {
  const response = await oauth.logout({ providerId: id })
  if (!response.result.ok) throw new Error(response.result.error.message)
}
