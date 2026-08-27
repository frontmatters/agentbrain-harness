// @vitest-environment jsdom
/** First-run provider onboarding behavior over the shared Models join. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Schema from '@agentbrain-harness/schemastery'
import type { RpcResponse, SettingsNamespaceView } from '@agentbrain-harness/api-remotes/client'
import { bindSnapshotSelector } from '@agentbrain-harness/client-test-runtime'
import { ProviderOnboardingDialog } from '../src/client/ProviderOnboardingDialog.tsx'
import type { ProviderOnboardingDialogProps } from '../src/client/ProviderOnboardingDialog.tsx'
import { SettingsDescribeMirror } from '@agentbrain-harness/client-ui-settings/src/client/settings-mirror.ts'
import { ModelsSettingsStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'
import { settingsSchema } from './settings-schema.client.ts'

afterEach(() => {
  cleanup()
  document.getElementById('root')?.remove()
})

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `onboarding-${nextRpc++}` as never, result: { ok: true, value } }
}
function fail<T>(message: string): RpcResponse<T> {
  return {
    rpcId: `onboarding-${nextRpc++}` as never,
    result: { ok: false, error: { code: 'internal', message, details: {} } },
  }
}

const PiAiConfig = Schema.object({
  providers: Schema.object({
    default: Schema.object({
      apiKeyEnv: Schema.string().role('credential-ref'),
      baseURL: Schema.string(),
      models: Schema.array(Schema.object({
        id: Schema.string().required(),
      })),
    }),
  }),
})

function defaultProviderNamespace(apiKeyEnv: string | null): SettingsNamespaceView {
  const inner = apiKeyEnv === null ? {} : { apiKeyEnv }
  const value = { providers: { default: inner } }
  return {
    ns: 'llm-pi-ai',
    schema: JSON.parse(JSON.stringify(PiAiConfig.toJSON())) as unknown,
    value,
    base: value,
    user: {},
    applies: 'live',
    secrets: [],
    revision: 0,
  }
}

/** A minimal agent-default-model namespace so the local start can write it. */
function agentDefaultModelNamespace(): SettingsNamespaceView {
  return {
    ns: 'agent-default-model',
    schema: {},
    value: {},
    base: {},
    user: {},
    applies: 'live',
    secrets: [],
    revision: 0,
  }
}

function harness(options: {
  provider?: boolean
  providerSettingsNs?: string
  providerActive?: boolean
  settingsNamespace?: boolean
  apiKeyEnv?: string | null
  configured?: () => boolean
  credential?: { source?: string; writable: boolean }
  describeFailure?: string
  settingsWritable?: boolean
  providersReject?: boolean
  setFailure?: string
  setReject?: string
  localModels?: readonly string[]
  localWriteFailure?: string
  providerList?: readonly { id: string; name: string }[]
  oauth?: {
    status?: ReturnType<typeof vi.fn>
    begin?: ReturnType<typeof vi.fn>
    providers?: ReturnType<typeof vi.fn>
  }
} = {}) {
  if (document.getElementById('root') === null) {
    const appRoot = document.createElement('div')
    appRoot.id = 'root'
    document.body.append(appRoot)
  }
  let fileConfigured = false
  const configured = options.configured ?? (() => fileConfigured)
  const apiKeyEnv = options.apiKeyEnv === undefined ? 'ABH_LLM_API_KEY' : options.apiKeyEnv
  const mutate = vi.fn((payload: { ns: string }) => {
    if (options.localWriteFailure !== undefined && payload.ns === 'llm-pi-ai') {
      return Promise.resolve(fail(options.localWriteFailure))
    }
    return Promise.resolve(ok(defaultProviderNamespace(apiKeyEnv)))
  })
  const set = vi.fn((_payload: { ref: string; value: string }) => {
    if (options.setReject !== undefined) return Promise.reject(new Error(options.setReject))
    if (options.setFailure !== undefined) return Promise.resolve(fail(options.setFailure))
    fileConfigured = true
    return Promise.resolve(ok({}))
  })
  const oauthStatus = options.oauth?.status ?? vi.fn(() => Promise.resolve(ok({ connected: false })))
  const oauthBegin = options.oauth?.begin ?? vi.fn(() => Promise.resolve(ok({ authUrl: 'https://example.com/auth' })))
  const providerList = options.providerList ?? [{ id: 'openai-codex', name: 'ChatGPT' }, { id: 'anthropic', name: 'Claude' }]
  const oauthProviders = options.oauth?.providers ?? vi.fn(() => Promise.resolve(ok({ providers: providerList })))
  const face = {
    llm: {
      providers: () => {
        if (options.providersReject === true) return Promise.reject(new Error('provider transport unavailable'))
        return Promise.resolve(ok({
          providers: options.provider === false
            ? []
            : [{
              provider: 'default',
              displayName: 'Default provider',
              settingsNs: options.providerSettingsNs ?? 'llm-pi-ai',
              settingsPath: ['providers', 'default'],
              active: options.providerActive ?? true,
            }],
        }))
      },
      discoverModels: () => Promise.resolve(ok({
        models: (options.localModels ?? []).map(id => ({ id })),
      })),
    },
    settings: {
      describe: () => Promise.resolve(ok({
        writable: options.settingsWritable ?? true,
        hasDocument: false,
        namespaces: options.settingsNamespace === false
          ? []
          : [
            defaultProviderNamespace(apiKeyEnv),
            ...options.localModels === undefined ? [] : [agentDefaultModelNamespace()],
          ],
      })),
      mutate,
    },
    credentials: {
      describe: () => options.describeFailure === undefined
        ? Promise.resolve(ok({
          credentials: {
            ABH_LLM_API_KEY: {
              configured: configured(),
              ...configured() && options.credential?.source !== undefined
                ? { source: options.credential.source }
                : {},
              writable: options.credential?.writable ?? true,
            },
          },
        }))
        : Promise.resolve(fail(options.describeFailure)),
      set,
    },
    oauth: {
      providers: oauthProviders,
      status: oauthStatus,
      begin: oauthBegin,
    },
  }
  const controller = new ModelsSettingsStore(face as never, settingsSchema, new SettingsDescribeMirror(face as never))
  const openSection = vi.fn()
  const complete = vi.fn()
  const unusedHook = (() => { throw new Error('unused standard hook') }) as never
  const props: ProviderOnboardingDialogProps = {
    stepId: 'default',
    complete,
    openSection,
    useSessions: unusedHook,
    useWorkspaces: unusedHook,
    controller,
    useModels: bindSnapshotSelector(controller.store),
    api: face as never,
    schema: settingsSchema,
    t: key => en[key],
  }
  return {
    controller, complete, openSection, props, mutate, set, oauthStatus, oauthBegin, oauthProviders,
    configure: () => { fileConfigured = true },
  }
}

/** The rendered sign-in label for a provider, from the onboarding templates. */
const continueLabel = (name: string): string => en.onboardingContinueProvider.replace('{name}', name)
const signinLabel = (name: string): string => en.onboardingSigninProvider.replace('{name}', name)

/** Expand the collapsed "Use an API key" row into the credential editor. */
function openApiKey(): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.onboardingApiKeyRow) }))
}

describe('ProviderOnboardingDialog', () => {
  it('renders when the shell root is absent', async () => {
    const h = harness()
    document.getElementById('root')!.remove()
    render(<ProviderOnboardingDialog {...h.props} />)
    expect(await screen.findByRole('dialog', { name: en.onboardingTitle })).toBeTruthy()
  })

  it('leads with sign-in buttons and a collapsed API-key row', async () => {
    const h = harness()
    render(<ProviderOnboardingDialog {...h.props} />)
    expect(await screen.findByRole('dialog', { name: en.onboardingTitle })).toBeTruthy()
    expect(document.getElementById('root')?.inert).toBe(true)
    expect(screen.getByText(en.onboardingSigninDescription)).toBeTruthy()
    // Both account-login buttons are present, with their templated labels.
    expect(await screen.findByRole('button', { name: continueLabel('ChatGPT') })).toBeTruthy()
    expect(screen.getByRole('button', { name: signinLabel('Claude') })).toBeTruthy()
    // The API-key path starts collapsed: its row shows, but no key field yet.
    expect(screen.getByRole('button', { name: new RegExp(en.onboardingApiKeyRow) })).toBeTruthy()
    expect(screen.queryByLabelText(en.keyInput)).toBeNull()
    // No local runtime answered, so no local row appears.
    expect(screen.queryByRole('button', { name: new RegExp(en.onboardingLocalRow) })).toBeNull()
  })

  it('shows a loading placeholder while the provider list is pending', async () => {
    const h = harness({ oauth: { providers: vi.fn(() => new Promise(() => {})) } })
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    expect(screen.getByText(en.providersLoading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: continueLabel('ChatGPT') })).toBeNull()
  })

  it('renders no sign-in section when the host lists no providers', async () => {
    const h = harness({ providerList: [] })
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    await waitFor(() => { expect(screen.queryByText(en.providersLoading)).toBeNull() })
    expect(screen.queryByText(en.onboardingConnectAnother)).toBeNull()
    // The API-key path is still offered.
    expect(screen.getByRole('button', { name: new RegExp(en.onboardingApiKeyRow) })).toBeTruthy()
  })

  it('expands the API-key row into a focused key field and collapses on Back', async () => {
    const h = harness()
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    openApiKey()
    const key = await screen.findByLabelText<HTMLInputElement>(en.keyInput)
    await waitFor(() => { expect(document.activeElement).toBe(key) })
    // Back collapses the panel without ending onboarding.
    fireEvent.click(screen.getByRole('button', { name: en.onboardingBack }))
    expect(screen.queryByLabelText(en.keyInput)).toBeNull()
    expect(screen.getByRole('button', { name: new RegExp(en.onboardingApiKeyRow) })).toBeTruthy()
    expect(h.complete).not.toHaveBeenCalled()
  })

  it('cannot be dismissed implicitly and restores the previous inert state', async () => {
    const h = harness()
    const appRoot = document.getElementById('root')!
    appRoot.inert = true
    const view = render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(document.querySelector('[class*="mask"]')!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(h.complete).not.toHaveBeenCalled()

    view.unmount()
    expect(appRoot.inert).toBe(true)
  })

  it('requires a non-blank key before Save and continue is available', async () => {
    const h = harness()
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    openApiKey()
    await screen.findByLabelText(en.keyInput)
    const save = screen.getByRole<HTMLButtonElement>('button', { name: en.onboardingSave })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(en.keyInput), { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
    expect(screen.getByText(en.keyRequired)).toBeTruthy()
    expect(h.set).not.toHaveBeenCalled()
  })

  it('keeps the modal open and reports rejected and failed credential writes', async () => {
    for (const [options, message] of [
      [{ setFailure: 'credential was rejected' }, 'credential was rejected'],
      [{ setReject: 'connection lost' }, 'connection lost'],
    ] as const) {
      const h = harness(options)
      const view = render(<ProviderOnboardingDialog {...h.props} />)
      await screen.findByRole('dialog')
      openApiKey()
      await screen.findByLabelText(en.keyInput)
      fireEvent.change(screen.getByLabelText(en.keyInput), { target: { value: 'sk-live' } })
      fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
      expect(await screen.findByText(message)).toBeTruthy()
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByRole<HTMLButtonElement>('button', { name: en.onboardingSave }).disabled).toBe(false)
      expect(h.complete).not.toHaveBeenCalled()
      expect(h.mutate).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('saves a cloud credential and refreshes the shared join', async () => {
    const h = harness()
    const load = vi.spyOn(h.controller, 'load')
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    openApiKey()
    await screen.findByLabelText(en.keyInput)
    fireEvent.change(screen.getByLabelText(en.keyInput), { target: { value: 'sk-live' } })
    fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
    await waitFor(() => { expect(h.set).toHaveBeenCalledOnce() })
    await waitFor(() => { expect(load).toHaveBeenCalled() })
  })

  it('does not block the product when provider setup is unavailable', async () => {
    for (const h of [
      harness({ describeFailure: 'credentials service is absent' }),
      harness({ credential: { writable: false } }),
      harness({ settingsWritable: false }),
      harness({ providersReject: true }),
      harness({ providerActive: false }),
      harness({ settingsNamespace: false }),
      harness({ apiKeyEnv: null }),
    ]) {
      const view = render(<ProviderOnboardingDialog {...h.props} />)
      await act(async () => { await h.controller.load() })
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => { expect(h.complete).toHaveBeenCalledOnce() })
      expect(h.openSection).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('skips an absent adapter and an already-configured environment credential', async () => {
    for (const h of [
      harness({ provider: false }),
      harness({ providerSettingsNs: '' }),
      harness({ configured: () => true, credential: { source: 'env', writable: false } }),
    ]) {
      const view = render(<ProviderOnboardingDialog {...h.props} />)
      await act(async () => { await h.controller.load() })
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => { expect(h.complete).toHaveBeenCalledOnce() })
      view.unmount()
    }
  })

  it('closes when an external credential invalidation refreshes the shared join', async () => {
    const h = harness()
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    h.configure()
    await act(async () => { await h.controller.load() })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
    expect(h.complete).toHaveBeenCalledOnce()
  })

  it('offers a keyless local start behind the local row when a runtime answers', async () => {
    const h = harness({ localModels: ['llama3.3', 'qwen2.5'] })
    render(<ProviderOnboardingDialog {...h.props} />)
    expect(await screen.findByRole('dialog', { name: en.onboardingTitle })).toBeTruthy()
    // The local path is a collapsed row until the user opens it.
    const localRow = await screen.findByRole('button', { name: new RegExp(en.onboardingLocalRow) })
    expect(screen.getByText(en.onboardingDetected)).toBeTruthy()
    fireEvent.click(localRow)
    const picker = await screen.findByLabelText<HTMLSelectElement>(en.onboardingLocalModel)
    expect([...picker.options].map(option => option.value)).toContain('qwen2.5')
    // The first model is preselected so Start is immediately usable.
    await waitFor(() => { expect(picker.value).toBe('llama3.3') })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.onboardingLocalStart }).disabled).toBe(false)
  })

  it('collapses the local panel on Back without ending onboarding', async () => {
    const h = harness({ localModels: ['llama3.3'] })
    render(<ProviderOnboardingDialog {...h.props} />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en.onboardingLocalRow) }))
    await screen.findByLabelText(en.onboardingLocalModel)
    fireEvent.click(screen.getByRole('button', { name: en.onboardingBack }))
    expect(screen.queryByLabelText(en.onboardingLocalModel)).toBeNull()
    expect(screen.getByRole('button', { name: new RegExp(en.onboardingLocalRow) })).toBeTruthy()
    expect(h.complete).not.toHaveBeenCalled()
  })

  it('writes the local route and default model, then completes, on local start', async () => {
    const h = harness({ localModels: ['llama3.3'] })
    render(<ProviderOnboardingDialog {...h.props} />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en.onboardingLocalRow) }))
    const picker = await screen.findByLabelText(en.onboardingLocalModel)
    fireEvent.change(picker, { target: { value: 'llama3.3' } })
    fireEvent.click(screen.getByRole('button', { name: en.onboardingLocalStart }))
    await waitFor(() => { expect(h.complete).toHaveBeenCalledOnce() })
    const written = h.mutate.mock.calls.map(([payload]) => payload.ns)
    expect(written).toContain('llm-pi-ai')
    expect(written).toContain('agent-default-model')
    expect(h.set).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and reports a failed local start', async () => {
    const h = harness({ localModels: ['llama3.3'], localWriteFailure: 'route rejected' })
    render(<ProviderOnboardingDialog {...h.props} />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en.onboardingLocalRow) }))
    const picker = await screen.findByLabelText(en.onboardingLocalModel)
    fireEvent.change(picker, { target: { value: 'llama3.3' } })
    fireEvent.click(screen.getByRole('button', { name: en.onboardingLocalStart }))
    expect(await screen.findByText(en.onboardingLocalFailed)).toBeTruthy()
    expect(h.complete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('opens the ChatGPT auth URL and shows a connecting state', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    // A begin that never resolves keeps the button in its connecting state.
    const oauthBegin = vi.fn(() => new Promise(() => {}))
    const h = harness({ oauth: { begin: oauthBegin } })
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    fireEvent.click(await screen.findByRole('button', { name: continueLabel('ChatGPT') }))
    await waitFor(() => { expect(h.oauthBegin).toHaveBeenCalledWith({ providerId: 'openai-codex' }) })
    // The button now shows the connecting label and is disabled.
    const connecting = await screen.findByRole<HTMLButtonElement>('button', { name: en.connecting })
    expect(connecting.disabled).toBe(true)
    openSpy.mockRestore()
  })

  it('begins the anthropic flow from the Claude button', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const h = harness()
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    fireEvent.click(await screen.findByRole('button', { name: signinLabel('Claude') }))
    await waitFor(() => { expect(h.oauthBegin).toHaveBeenCalledWith({ providerId: 'anthropic' }) })
  })

  it('completes onboarding when the OAuth poll reports connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const oauthStatus = vi.fn().mockResolvedValueOnce(ok({ connected: true, type: 'oauth' }))
    const h = harness({ oauth: { status: oauthStatus } })
    vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      render(<ProviderOnboardingDialog {...h.props} />)
      await act(async () => { await Promise.resolve() })
      expect(screen.getByRole('dialog')).toBeTruthy()
      fireEvent.click(await screen.findByRole('button', { name: continueLabel('ChatGPT') }))
      await act(async () => { await Promise.resolve() })
      await act(async () => { vi.advanceTimersByTime(1500) })
      await act(async () => { await Promise.resolve() })
      expect(h.complete).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes the provider route and default model on connect, then completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const oauthStatus = vi.fn().mockResolvedValueOnce(ok({ connected: true, type: 'oauth' }))
    const h = harness({ oauth: { status: oauthStatus }, localModels: ['gpt-5.6-terra'] })
    vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      render(<ProviderOnboardingDialog {...h.props} />)
      await act(async () => { await Promise.resolve() })
      fireEvent.click(await screen.findByRole('button', { name: continueLabel('ChatGPT') }))
      await act(async () => { await Promise.resolve() })
      await act(async () => { vi.advanceTimersByTime(1500) })
      for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })
      const calls = h.mutate.mock.calls as unknown as [{ ns: string; ops: { op: string; path: string[]; value?: unknown }[] }][]
      const routeWrite = calls.find(([payload]) => payload.ns === 'llm-pi-ai' && payload.ops[0]?.path[1] === 'openai-codex')
      expect(routeWrite?.[0].ops[0]).toEqual({ op: 'set', path: ['providers', 'openai-codex'], value: { displayName: 'ChatGPT' } })
      const defaultWrite = calls.find(([payload]) => payload.ns === 'agent-default-model')
      expect(defaultWrite?.[0].ops).toEqual([
        { op: 'set', path: ['provider'], value: 'openai-codex' },
        { op: 'set', path: ['model'], value: 'gpt-5.6-terra' },
      ])
      expect(h.complete).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the connect-failed error when begin rejects', async () => {
    const oauthBegin = vi.fn(() => Promise.reject(new Error('network error')))
    const h = harness({ oauth: { begin: oauthBegin } })
    render(<ProviderOnboardingDialog {...h.props} />)
    await screen.findByRole('dialog')
    fireEvent.click(await screen.findByRole('button', { name: continueLabel('ChatGPT') }))
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(en.connectFailed)).toBeTruthy()
    expect(h.complete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
