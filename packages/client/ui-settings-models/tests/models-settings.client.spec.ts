// @vitest-environment jsdom
/**
 * OAuth connect-row state-machine e2e. Drives the not-connected → connecting
 * → connected transition against a mocked oauth wire. The poll interval is
 * kept at its production value; the status mock is scripted so the first poll
 * after beginConnect already answers connected, keeping the test fast without
 * fake timers (which deadlock under waitFor in this environment).
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@agentbrain-harness/client-test-runtime'
import type { RpcResponse, SettingsNamespaceView } from '@agentbrain-harness/api-remotes/client'
import Schema from '@agentbrain-harness/schemastery'
import React from 'react'
import { ModelsSection } from '../src/client/ModelsSection.tsx'
import type { ModelsSectionProps } from '../src/client/ModelsSection.tsx'
import { SettingsDescribeMirror } from '@agentbrain-harness/client-ui-settings/src/client/settings-mirror.ts'
import { ModelsSettingsStore } from '../src/client/store.ts'
import { en, type ModelsKey } from '../src/client/locales.ts'
import { settingsSchema } from './settings-schema.client.ts'

afterEach(cleanup)

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `r-${nextRpc++}` as never, result: { ok: true, value } }
}

const PiAiConfig = Schema.object({
  providers: Schema.dict(Schema.object({
    apiKeyEnv: Schema.string().role('credential-ref'),
    baseURL: Schema.string(),
  })),
})

function wireNamespaces(): SettingsNamespaceView[] {
  return [
    {
      ns: 'llm-pi-ai',
      schema: JSON.parse(JSON.stringify(PiAiConfig.toJSON())) as unknown,
      value: {},
      applies: 'live',
      secrets: [],
      revision: 0,
    },
  ]
}

type WireFace = ConstructorParameters<typeof ModelsSettingsStore>[0]

const t = (key: ModelsKey): string => en[key]

/** Build a minimal scripted face and mount the section. */
async function mountOAuthSection(oauthOverrides: {
  status?: ReturnType<typeof vi.fn>
  begin?: ReturnType<typeof vi.fn>
  logout?: ReturnType<typeof vi.fn>
  providers?: ReturnType<typeof vi.fn>
} = {}) {
  const oauthStatus = oauthOverrides.status ?? vi.fn(() => Promise.resolve(ok({ connected: false })))
  const oauthBegin = oauthOverrides.begin ?? vi.fn(() => Promise.resolve(ok({ authUrl: 'https://example.com/auth' })))
  const oauthLogout = oauthOverrides.logout ?? vi.fn(() => Promise.resolve(ok({})))
  const oauthProviders = oauthOverrides.providers
    ?? vi.fn(() => Promise.resolve(ok({ providers: [{ id: 'openai-codex', name: 'ChatGPT' }] })))
  const face = {
    llm: {
      discoverModels: vi.fn(() => Promise.resolve(ok({ models: [] }))),
      providers: vi.fn(() => Promise.resolve(ok({ providers: [] }))),
      models: vi.fn(() => Promise.resolve(ok({ groups: [], failures: [] }))),
    },
    settings: {
      describe: vi.fn(() => Promise.resolve(ok({ writable: true, hasDocument: false, namespaces: wireNamespaces() }))),
      update: vi.fn(() => Promise.resolve(ok(wireNamespaces()[0]))),
      replace: vi.fn(() => Promise.resolve(ok(wireNamespaces()[0]))),
      mutate: vi.fn(() => Promise.resolve(ok(wireNamespaces()[0]))),
    },
    credentials: {
      describe: vi.fn(() => Promise.resolve(ok({ credentials: {} }))),
      set: vi.fn(() => Promise.resolve(ok({}))),
      unset: vi.fn(() => Promise.resolve(ok({}))),
    },
    oauth: { providers: oauthProviders, status: oauthStatus, begin: oauthBegin, logout: oauthLogout },
  }
  const mirror = new SettingsDescribeMirror(face as never)
  const controller = new ModelsSettingsStore(face as unknown as WireFace, settingsSchema, mirror)
  await controller.load()
  const injected: ModelsSectionProps = {
    controller,
    useSnapshot: bindSnapshotSelector(controller.store),
    api: face as never,
    schema: settingsSchema,
    t,
  }
  const rendered = render(React.createElement(ModelsSection, injected))
  return { face, oauthStatus, oauthBegin, oauthLogout, unmount: rendered.unmount }
}

describe('OAuth connect-row state machine (e2e)', () => {
  it('transitions from not-connected through connecting to connected when status flips', async () => {
    // Mount probe (first status call) → not connected.
    // The first poll after beginConnect answers connected immediately, so the
    // test completes in one ~1500 ms interval without fake timers.
    // Two OAuth rows now mount (ChatGPT + Claude); keep the flip scoped to
    // openai-codex so Claude stays not-connected and the assertions stay unique.
    let codexProbes = 0
    const oauthStatus = vi.fn(({ providerId }: { providerId: string }) => {
      if (providerId !== 'openai-codex') return Promise.resolve(ok({ connected: false }))
      codexProbes += 1
      // The mount probe (first) is not connected; every poll after begin is.
      return Promise.resolve(ok(codexProbes === 1 ? { connected: false } : { connected: true, type: 'oauth' }))
    })
    const oauthBegin = vi.fn(() => Promise.resolve(ok({ authUrl: 'https://auth.example.com/oauth' })))
    vi.spyOn(window, 'open').mockImplementation(() => null)

    const { face } = await mountOAuthSection({ status: oauthStatus, begin: oauthBegin })

    // Initial probe resolves: row shows Connect ChatGPT.
    await waitFor(() => { expect(screen.queryByRole('button', { name: en.connectProvider.replace('{name}', 'ChatGPT') })).toBeTruthy() })

    // Click connect — begin is called, URL opened, row enters connecting.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.connectProvider.replace('{name}', 'ChatGPT') }))
    })
    await waitFor(() => { expect(oauthBegin).toHaveBeenCalledWith({ providerId: 'openai-codex' }) })

    // The first poll (~1500 ms) answers connected: wait for the connected state.
    // waitFor's default interval polls every 50 ms until timeout (1000 ms default);
    // the production poll fires at 1500 ms so extend the waitFor timeout to 3000 ms.
    await waitFor(
      () => { expect(screen.queryByRole('button', { name: en.disconnect })).toBeTruthy() },
      { timeout: 3000 },
    )
    expect(screen.queryByRole('button', { name: en.connectProvider.replace('{name}', 'ChatGPT') })).toBeNull()

    // On connect the provider's catalog route is written so its models surface.
    const mutateCalls = (face.settings.mutate as ReturnType<typeof vi.fn>).mock.calls as unknown as
      [{ ns: string; ops: { op: string; path: string[]; value?: unknown }[] }][]
    const routeWrite = mutateCalls.find(([payload]) =>
      payload.ns === 'llm-pi-ai' && payload.ops[0]?.path[1] === 'openai-codex')
    expect(routeWrite?.[0].ops[0]).toEqual({ op: 'set', path: ['providers', 'openai-codex'], value: { displayName: 'ChatGPT' } })
  }, 10_000)

  it('shows the failed state when begin rejects', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const oauthBegin = vi.fn(() => Promise.reject(new Error('denied')))
    await mountOAuthSection({ begin: oauthBegin })

    await waitFor(() => { expect(screen.queryByRole('button', { name: en.connectProvider.replace('{name}', 'ChatGPT') })).toBeTruthy() })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.connectProvider.replace('{name}', 'ChatGPT') }))
    })
    await waitFor(() => { expect(screen.queryByText(en.connectFailed)).toBeTruthy() })
  })

  it('returns to the failed state when disconnect rejects', async () => {
    // Mount probe reports connected so the Disconnect button renders; logout then
    // rejects, driving the row into the error phase.
    const oauthStatus = vi.fn(() => Promise.resolve(ok({ connected: true, type: 'oauth' })))
    const oauthLogout = vi.fn(() => Promise.reject(new Error('offline')))
    await mountOAuthSection({ status: oauthStatus, logout: oauthLogout })

    await waitFor(() => { expect(screen.queryByRole('button', { name: en.disconnect })).toBeTruthy() })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.disconnect })) })
    await waitFor(() => { expect(screen.queryByText(en.connectFailed)).toBeTruthy() })
  })

  it('ignores a status probe that resolves after unmount', async () => {
    let resolveStatus: (value: RpcResponse<{ connected: boolean }>) => void = () => {}
    const statusPromise = new Promise<RpcResponse<{ connected: boolean }>>((resolve) => { resolveStatus = resolve })
    const oauthStatus = vi.fn(() => statusPromise)
    const { unmount } = await mountOAuthSection({ status: oauthStatus })

    // The provider list rendered, so the per-provider probe has been issued.
    await waitFor(() => { expect(oauthStatus).toHaveBeenCalled() })
    unmount()
    // Resolving after unmount hits the cancelled guard; no state write, no throw.
    await act(async () => { resolveStatus(ok({ connected: true })); await Promise.resolve() })
  })
})
