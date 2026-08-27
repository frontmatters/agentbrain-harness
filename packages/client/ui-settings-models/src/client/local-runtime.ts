/**
 * Local-runtime detection for the local-first first run. It probes an
 * OpenAI-compatible endpoint by URL, so it works before any route is
 * configured: a running local runtime such as Ollama answers the model
 * listing, which lets the onboarding offer a keyless local start, and any
 * failure means the onboarding offers the cloud path instead. The onboarding
 * writes the `local` route into settings only when the user starts local, so
 * the endpoint is never a config-shipped always-active route.
 *
 * @module @agentbrain-harness/client-ui-settings-models/local-runtime
 */

import type { IApiClient, SettingsPathOpView } from '@agentbrain-harness/api-remotes/client'
import { mutateNamespace } from './settings-mutate.ts'
import type { MutateNamespaceResult, SettingsMutateFace } from './settings-mutate.ts'

/** The pi-ai route id the onboarding writes for a local runtime. */
export const LOCAL_ROUTE = 'local'

/** The pi-ai settings namespace that owns provider routes. */
export const PI_AI_NAMESPACE = 'llm-pi-ai'

/** The OpenAI-compatible wire protocol a local runtime speaks. */
export const LOCAL_API = 'openai-completions'

/** Ollama's default OpenAI-compatible endpoint; the probe target and route baseURL. */
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1'

/** Availability of a local runtime and the models it serves. */
export interface LocalRuntime {
  /** True when the runtime answered with at least one model. */
  available: boolean
  /** Model ids the runtime serves; empty when unavailable. */
  models: readonly string[]
}

/**
 * Probe an OpenAI-compatible endpoint for a local runtime by URL. The probe
 * carries no credential, so a keyless runtime answers and a route that needs a
 * key simply reports unavailable rather than erroring the first run.
 * @param llm - the llm wire face carrying discoverModels.
 * @param baseURL - the endpoint to probe; defaults to Ollama's local URL.
 * @returns the runtime availability and its model ids.
 */
export async function probeLocalRuntime(
  llm: Pick<IApiClient['llm'], 'discoverModels'>,
  baseURL: string = DEFAULT_LOCAL_BASE_URL,
): Promise<LocalRuntime> {
  try {
    const response = await llm.discoverModels({ settingsNs: PI_AI_NAMESPACE, baseURL, api: LOCAL_API })
    if (!response.result.ok) return { available: false, models: [] }
    const models = response.result.value.models.map(model => model.id)
    return { available: models.length > 0, models }
  } catch {
    // A rejected transport means no reachable local runtime; the caller falls
    // back to the cloud path rather than surfacing a probe error on first run.
    return { available: false, models: [] }
  }
}

/** The `local` route the onboarding writes when the user starts local. */
export interface LocalRouteSelection {
  /** The model id the user chose from the probed runtime. */
  model: string
  /**
   * All model ids to record on the route. When present, the route serves this
   * whole detected catalog; when omitted, it serves {@link model} alone (the
   * onboarding's single-model start).
   */
  models?: readonly string[]
  /** The endpoint to record; defaults to Ollama's local URL. */
  baseURL?: string
}

/**
 * Provision the keyless `local` pi-ai route in the user's settings. The base
 * bundle ships no local route, so starting local writes the route here before
 * the default-model choice points at it. The route needs no credential.
 * @param settings - the settings wire face (describe + mutate).
 * @param selection - the chosen model and optional endpoint.
 * @returns whether the write landed, with a reason when it did not.
 */
export async function writeLocalRoute(
  settings: SettingsMutateFace,
  selection: LocalRouteSelection,
): Promise<MutateNamespaceResult> {
  const ops: SettingsPathOpView[] = [{
    op: 'set',
    path: ['providers', LOCAL_ROUTE],
    value: {
      displayName: 'Local (Ollama)',
      api: LOCAL_API,
      baseURL: selection.baseURL ?? DEFAULT_LOCAL_BASE_URL,
      // A keyless route resolves to empty auth, but the OpenAI-compatible
      // protocol still refuses a request that carries neither an api key nor an
      // Authorization header. A local runtime ignores the token, so a static
      // placeholder header satisfies the protocol without a stored credential.
      headers: { Authorization: 'Bearer local' },
      models: (selection.models ?? [selection.model]).map(id => ({ id })),
    },
  }]
  return mutateNamespace(settings, PI_AI_NAMESPACE, ops)
}
