/**
 * First-run provider onboarding. Readiness comes from the same
 * provider/settings/credential join as the Models page: any provider the user
 * can already talk to ends the step, and only a user with none is prompted.
 *
 * When prompted, sign-in comes first: one account-login button per pi-ai OAuth
 * provider (ChatGPT, Claude), each keyless. Below a divider, two collapsed rows
 * expand in place to the other paths — an API key for any OpenAI-compatible
 * provider (the Models page's credential editor) and, when a local runtime
 * answers the probe, a keyless local start (this package's model-choice
 * primitives). Only one row is expanded at a time; the choice is entered once.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'
import type { SnapshotStore } from '@agentbrain-harness/client-runtime/client'
import type { InjectFace, PropsRuntime } from '@agentbrain-harness/client-ui-slots'
import type { ModelsSettingsState, ModelsSettingsStore } from './store.ts'
import { onboardingReadiness } from './store.ts'
import type { SettingsSchemaOperations } from './schema-operations.ts'
import { ProviderEditor } from './ProviderEditor.tsx'
import { ModelPicker } from './ModelPicker.tsx'
import { ProviderMark } from './BrandMarks.tsx'
import { LOCAL_ROUTE, probeLocalRuntime, writeLocalRoute } from './local-runtime.ts'
import type { LocalRuntime } from './local-runtime.ts'
import { writeDefaultModel } from './default-model.ts'
import {
  fetchOAuthProviders, readProviderOverlay, applyProviderOverlay,
  runOAuthConnect, writeOAuthProviderRoute, firstModelForProvider,
} from './connect-provider.ts'
import type { OAuthProvider } from './connect-provider.ts'
import type { en } from './locales.ts'
import { OnboardingModal } from './OnboardingModal.tsx'
import styles from './ProviderOnboardingDialog.module.css'

/** Registration-side dependencies of {@link ProviderOnboardingDialog}. */
export interface ProviderOnboardingInjected {
  hooks: {
    /** Shared Models-page join state, bound by the slot renderer. */
    models: SnapshotStore<ModelsSettingsState>
  }
  /** Shared Models-page join controller. */
  controller: ModelsSettingsStore
  /** Wire face: settings writes, credential editor, local-runtime probe, and OAuth connect. */
  api: Pick<IApiClient, 'settings' | 'credentials' | 'llm' | 'oauth'>
  /** Settings schema and immutable path callbacks. */
  schema: SettingsSchemaOperations
  /** Feature copy. */
  t: (key: keyof typeof en) => string
}

/** Slot owner props plus the feature's injected dependencies. */
export type ProviderOnboardingDialogProps =
  PropsRuntime<'settings.onboarding'> & InjectFace<ProviderOnboardingInjected>

/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever(_value: never): never {
  throw new Error('unexpected provider onboarding state')
}

/** Which secondary path, if any, is expanded in place. */
type Expanded = 'none' | 'api-key' | 'local'

/** The key icon on the API-key row. */
function KeyIcon(): ReactNode {
  return (
    <svg className={styles.rowIcon} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l2 2M14 9l2 2" />
    </svg>
  )
}

/** The chip icon on the local-model row. */
function ChipIcon(): ReactNode {
  return (
    <svg className={styles.rowIcon} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  )
}

/** The trailing chevron on a collapsed row. */
function Chevron(): ReactNode {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/**
 * Prompt a first-run user to start a model while no provider can serve requests:
 * an account sign-in, an API key, or a keyless local runtime when one answers.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding modal or null when onboarding needs no intervention.
 */
export function ProviderOnboardingDialog(props: ProviderOnboardingDialogProps): ReactNode {
  const { complete, controller, useModels, api, schema, t } = props
  const state = useModels(snapshot => snapshot)
  const readiness = onboardingReadiness(state)
  // The sign-in providers come from the host catalog plus the display overlay;
  // undefined means still loading. Substitute a provider name into a template.
  const [providers, setProviders] = useState<OAuthProvider[] | undefined>(undefined)
  const fill = (key: keyof typeof en, name: string): string => t(key).replace('{name}', name)
  const [runtime, setRuntime] = useState<LocalRuntime | undefined>(undefined)
  const [localModel, setLocalModel] = useState<string | undefined>(undefined)
  const [starting, setStarting] = useState(false)
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  const [expanded, setExpanded] = useState<Expanded>('none')

  // Per-provider OAuth state for the onboarding chooser.
  type OAuthPhase = 'idle' | 'connecting' | 'connected' | 'error'
  const [oauthPhase, setOauthPhase] = useState<Record<string, OAuthPhase>>(() => ({}))

  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [controller, state.status])

  useEffect(() => {
    if (
      readiness.kind === 'adapter-absent'
      || readiness.kind === 'provider-ready'
      || readiness.kind === 'unavailable'
    ) complete()
  }, [complete, readiness.kind])

  // When an OAuth provider connects during the onboarding chooser, proceed as
  // if the user completed the flow: call complete() so the onboarding step ends.
  useEffect(() => {
    if (Object.values(oauthPhase).includes('connected')) complete()
  }, [complete, oauthPhase])

  // Load the connectable providers (host catalog) merged with the display
  // overlay, once the dialog is shown. A failure yields an empty list, which
  // leaves the API-key and local paths.
  useEffect(() => {
    if (readiness.kind !== 'credential-missing') return
    let cancelled = false
    void Promise.all([fetchOAuthProviders(api.oauth), readProviderOverlay(api.settings)]).then(([list, overlay]) => {
      /* v8 ignore next -- the cancelled guard only fires when the fiber unmounts mid-load */
      if (cancelled) return
      setProviders(applyProviderOverlay(list, overlay))
    })
    return () => { cancelled = true }
  }, [api.oauth, api.settings, readiness.kind])

  // Probe the local runtime once the dialog is shown, so a first run with Ollama
  // running can offer a keyless local row. A failure leaves the sign-in and
  // API-key paths only.
  useEffect(() => {
    if (readiness.kind !== 'credential-missing') return
    let cancelled = false
    /* v8 ignore next -- the cancelled guard only fires when the fiber unmounts mid-probe */
    void probeLocalRuntime(api.llm).then((probed) => {
      if (cancelled) return
      setRuntime(probed)
      // Preselect the first model so the picker shows a real choice and Start is
      // usable immediately; the user can still pick another.
      if (probed.models[0] !== undefined) setLocalModel(probed.models[0])
    })
    return () => { cancelled = true }
  }, [api.llm, readiness.kind])

  /**
   * Start the OAuth connect flow for a provider. Opens the authorization URL in
   * a new tab and polls oauth.status until the user completes the flow
   * (connected) or the cap is reached (error).
   * @param id - the pi-ai provider id to connect.
   */
  const connectOAuth = (id: string, name: string): void => {
    runOAuthConnect(api.oauth, id, {
      onConnecting: () => { setOauthPhase(prev => ({ ...prev, [id]: 'connecting' })) },
      onConnected: () => {
        void finishOAuthConnected(id, name).catch(() => {
          setOauthPhase(prev => ({ ...prev, [id]: 'error' }))
        })
      },
      onError: () => { setOauthPhase(prev => ({ ...prev, [id]: 'error' })) },
    })
  }

  /**
   * A connected provider has a stored credential but is not yet a mounted route,
   * so first-run onboarding would otherwise end with nothing usable. Mirror the
   * API-key/local paths: write the provider's route, point the default model at
   * its first model, then flip to connected — which ends onboarding through the
   * anyConnected effect. The default-model write is best-effort; connecting still
   * completes so a discovery miss leaves the user connected, not stuck.
   */
  const finishOAuthConnected = async (id: string, name: string): Promise<void> => {
    await writeOAuthProviderRoute(api.settings, id, name)
    const model = await firstModelForProvider(api.llm, id)
    if (model !== undefined) await writeDefaultModel(api.settings, { provider: id, model })
    setOauthPhase(prev => ({ ...prev, [id]: 'connected' }))
  }

  switch (readiness.kind) {
    case 'loading':
    case 'adapter-absent':
    case 'provider-ready':
    case 'unavailable':
      return null
    case 'credential-missing':
      break
    /* v8 ignore next -- every current readiness variant is handled above */
    default:
      return assertNever(readiness)
  }

  const row = state.rows.find(candidate =>
    candidate.entry.provider === 'default'
    && candidate.entry.settingsNs === 'llm-pi-ai')
  const namespace = state.namespaces.get('llm-pi-ai')
  /* v8 ignore next 2 -- credential-missing is derived only from this exact joined row. */
  if (row === undefined || namespace === undefined) return null

  const startLocal = async (): Promise<void> => {
    /* v8 ignore next -- the Start button stays disabled until a model is chosen */
    if (localModel === undefined) return
    setStarting(true)
    setLocalError(undefined)
    const route = await writeLocalRoute(api.settings, { model: localModel })
    const written = route.ok
      ? await writeDefaultModel(api.settings, { provider: LOCAL_ROUTE, model: localModel })
      : route
    if (written.ok) {
      complete()
      return
    }
    setStarting(false)
    setLocalError(t('onboardingLocalFailed'))
  }

  // Saving a key re-derives readiness, which ends onboarding once a provider is
  // ready; cancelling only collapses the row back to the sign-in choices.
  const finishCredential = (changed: boolean): void => {
    if (changed) {
      void controller.load()
      return
    }
    setExpanded('none')
  }

  return (
    <OnboardingModal title={t('onboardingTitle')}>
      <p className={styles.description}>{t('onboardingSigninDescription')}</p>
      {providers === undefined
        ? <p className={styles.description}>{t('providersLoading')}</p>
        : providers.length === 0
          ? null
          : (
            <>
              <div className={styles.signin}>
                {providers.map((provider, index) => {
                  const phase = oauthPhase[provider.id] ?? 'idle'
                  const primary = index === 0
                  const label = fill(primary ? 'onboardingContinueProvider' : 'onboardingSigninProvider', provider.name)
                  return (
                    <div key={provider.id} className={primary ? styles.signinPrimary : styles.signinCell}>
                      <button
                        type="button"
                        className={primary ? styles.primary : styles.secondary}
                        {...primary ? {} : { 'aria-label': label }}
                        disabled={phase === 'connecting'}
                        onClick={() => { connectOAuth(provider.id, provider.name) }}
                      >
                        <ProviderMark logo={provider.logo} name={provider.name} className={styles.buttonMark} />
                        {phase === 'connecting' ? t('connecting') : primary ? label : provider.name}
                      </button>
                      {phase === 'error'
                        ? <p className={styles.error}>{t('connectFailed')}</p>
                        : null}
                    </div>
                  )
                })}
              </div>
              <div className={styles.divider}><span>{t('onboardingConnectAnother')}</span></div>
            </>
          )}
      <div className={styles.rows}>
        {expanded === 'api-key'
          ? (
            <div className={styles.panel}>
              <ProviderEditor
                provider={row.entry.provider}
                displayName={row.entry.displayName}
                namespace={namespace}
                schema={schema}
                settingsPath={row.entry.settingsPath}
                api={api}
                t={t}
                readOnly={false}
                hideTitle
                credentialOnly
                credentialRequired
                autoFocusCredential
                cancelLabel="onboardingBack"
                submitLabel="onboardingSave"
                submitBusyLabel="onboardingSaving"
                onClose={finishCredential}
              />
            </div>
          )
          : (
            <button type="button" className={styles.rowCard} onClick={() => { setExpanded('api-key') }}>
              <span className={styles.rowIconWrap}><KeyIcon /></span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t('onboardingApiKeyRow')}</span>
                <span className={styles.rowHint}>{t('onboardingApiKeyRowHint')}</span>
              </span>
              <Chevron />
            </button>
          )}
        {runtime?.available === true
          ? (expanded === 'local'
            ? (
              <div className={styles.panel}>
                <ModelPicker
                  label={t('onboardingLocalModel')}
                  models={runtime.models}
                  value={localModel}
                  onChange={setLocalModel}
                  disabled={starting}
                />
                {localError === undefined ? null : <p className={styles.error}>{localError}</p>}
                <div className={styles.panelActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={starting}
                    onClick={() => { setExpanded('none') }}
                  >
                    {t('onboardingBack')}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={localModel === undefined || starting}
                    onClick={() => { void startLocal() }}
                  >
                    {starting ? t('onboardingLocalStarting') : t('onboardingLocalStart')}
                  </button>
                </div>
              </div>
            )
            : (
              <button type="button" className={styles.rowCard} onClick={() => { setExpanded('local') }}>
                <span className={styles.rowIconWrap}><ChipIcon /></span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('onboardingLocalRow')}</span>
                  <span className={styles.rowHint}>{t('onboardingLocalRowHint')}</span>
                </span>
                <span className={styles.badge}>{t('onboardingDetected')}</span>
              </button>
            ))
          : null}
      </div>
      <button type="button" className={styles.later} onClick={complete}>
        {t('onboardingLater')}
      </button>
    </OnboardingModal>
  )
}
