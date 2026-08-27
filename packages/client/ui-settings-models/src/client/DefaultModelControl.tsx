/**
 * The Models page's default-model control. It shows the agent's current default
 * model and lets the user switch it among the models its provider route serves,
 * reusing the shared {@link ModelPicker} and {@link writeDefaultModel}. The
 * model list is resolved by {@link resolveProviderModels}: a live endpoint probe
 * first (so a local runtime lists every model it serves), then the host catalog
 * as a fallback. Switching the provider itself stays with the composer and
 * first-run onboarding.
 *
 * @module @agentbrain-harness/client-ui-settings-models/DefaultModelControl
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'
import { ModelPicker } from './ModelPicker.tsx'
import { writeDefaultModel } from './default-model.ts'
import type { DefaultModelSelectionView, ModelsSettingsStore, RouteDiscovery } from './store.ts'
import type { en } from './locales.ts'
import styles from './DefaultModelControl.module.css'

/** The subset of the llm wire face the control reads models through. */
type LlmModelsFace = Pick<IApiClient['llm'], 'models' | 'discoverModels'>

/**
 * Resolve the models a provider route serves. It probes the route's endpoint
 * live when discovery parameters are given, so a local runtime lists every
 * model it serves rather than only the one configured; an unreachable or empty
 * probe falls back to the host catalog, which keeps a keyed cloud route working.
 * @param llm - the llm wire face (discoverModels + models).
 * @param provider - the provider route id to resolve within the catalog fallback.
 * @param discover - live-probe parameters for the route, when it names an endpoint.
 * @returns the model ids the route serves, or an empty list when neither source answers.
 */
export async function resolveProviderModels(
  llm: LlmModelsFace,
  provider: string,
  discover: RouteDiscovery | undefined,
): Promise<readonly string[]> {
  if (discover !== undefined) {
    try {
      const probe = await llm.discoverModels({
        settingsNs: discover.settingsNs,
        baseURL: discover.baseURL,
        ...discover.api === undefined ? {} : { api: discover.api },
      })
      if (probe.result.ok && probe.result.value.models.length > 0) {
        return probe.result.value.models.map(model => model.id)
      }
    } catch {
      // An unreachable endpoint is not an error here: the catalog below still
      // answers for a keyed cloud route, and a dead local route reports empty.
    }
  }
  try {
    const catalog = await llm.models({})
    if (!catalog.result.ok) return []
    return catalog.result.value.groups.find(group => group.id === provider)?.models.map(model => model.id) ?? []
  } catch {
    // Neither source answered; the picker reports empty rather than surfacing a
    // read error on a settings page the user did not act on.
    return []
  }
}

/** Props for {@link DefaultModelControl}. */
export interface DefaultModelControlProps {
  /** Wire faces: the model reads and the default-model write. */
  api: Pick<IApiClient, 'settings' | 'llm'>
  /** The page store, reloaded after a successful switch. */
  controller: ModelsSettingsStore
  /** The current default selection, or absent when none is set. */
  current?: DefaultModelSelectionView
  /** Live-discovery parameters for the current provider route, when it names an endpoint. */
  discover?: RouteDiscovery
  /** Display name for the current provider route. */
  providerLabel?: string
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/**
 * Render the default-model control, or nothing when no default is set.
 * @param props - the control's wire faces, current selection, and copy.
 * @returns the labelled model picker for the agent default.
 */
export function DefaultModelControl(props: DefaultModelControlProps): ReactNode {
  const { api, controller, current, discover, providerLabel, t } = props
  const [models, setModels] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  const provider = current?.provider
  const model = current?.model
  const baseURL = discover?.baseURL
  useEffect(() => {
    if (provider === undefined) return
    let cancelled = false
    setBusy(true)
    void resolveProviderModels(api.llm, provider, discover).then((ids) => {
      /* v8 ignore next -- the cancelled guard only fires when the fiber unmounts mid-fetch */
      if (cancelled) return
      setBusy(false)
      // Keep the current model selectable even if neither source lists it.
      setModels(model !== undefined && !ids.includes(model) ? [model, ...ids] : ids)
    })
    return () => { cancelled = true }
    // discover is re-derived each render; its primitive fields are the real deps.
  }, [api.llm, provider, model, baseURL, discover?.settingsNs, discover?.api])

  if (current === undefined) return null

  const save = async (next: string): Promise<void> => {
    if (next === current.model) return
    setError(undefined)
    const result = await writeDefaultModel(api.settings, { provider: current.provider, model: next })
    if (!result.ok) {
      setError(t('defaultModelSaveFailed'))
      return
    }
    await controller.load()
  }

  const label = providerLabel === undefined
    ? t('defaultModel')
    : `${t('defaultModel')} · ${providerLabel}`

  return (
    <div className={styles['control']}>
      <ModelPicker
        label={label}
        models={models}
        value={current.model}
        onChange={(next) => { void save(next) }}
        busy={busy}
        {...error === undefined ? {} : { error }}
      />
    </div>
  )
}
