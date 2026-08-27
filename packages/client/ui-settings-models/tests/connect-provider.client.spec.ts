// @vitest-environment jsdom
/**
 * Unit coverage for the connect-provider helpers the component tests do not
 * fully reach: model discovery, the oauth status/begin/logout wire wrappers, and
 * the poll loop in runOAuthConnect. The happy connect path is also exercised
 * end-to-end through the onboarding dialog and Models section tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  firstModelForProvider, fetchOAuthProviders, readProviderOverlay, applyProviderOverlay,
  probeOAuthStatus, beginConnect, disconnect, runOAuthConnect,
  PROVIDER_OVERLAY_NAMESPACE,
} from '../src/client/connect-provider.ts'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'

type LlmFace = Pick<IApiClient['llm'], 'discoverModels'>
type OauthFace = Pick<IApiClient['oauth'], 'providers'>
type SettingsFace = Pick<IApiClient['settings'], 'describe'>
type OauthStatusFace = Pick<IApiClient['oauth'], 'status'>
type OauthBeginFace = Pick<IApiClient['oauth'], 'begin'>
type OauthLogoutFace = Pick<IApiClient['oauth'], 'logout'>
type OauthConnectFace = Pick<IApiClient['oauth'], 'begin' | 'status'>

const okResult = <T>(value: T) => ({ rpcId: 'r' as never, result: { ok: true as const, value } })
const notOk = { rpcId: 'r' as never, result: { ok: false as const, error: { code: 'x', message: 'no', details: {} } } }

describe('fetchOAuthProviders', () => {
  it('returns the host providers on ok', async () => {
    const oauth = { providers: vi.fn(() => Promise.resolve(okResult({ providers: [{ id: 'openai-codex', name: 'OpenAI Codex' }] }))) } as unknown as OauthFace
    expect(await fetchOAuthProviders(oauth)).toEqual([{ id: 'openai-codex', name: 'OpenAI Codex' }])
  })
  it('returns empty on not-ok', async () => {
    const oauth = { providers: vi.fn(() => Promise.resolve(notOk)) } as unknown as OauthFace
    expect(await fetchOAuthProviders(oauth)).toEqual([])
  })
  it('returns empty when the transport rejects', async () => {
    const oauth = { providers: vi.fn(() => Promise.reject(new Error('down'))) } as unknown as OauthFace
    expect(await fetchOAuthProviders(oauth)).toEqual([])
  })
})

describe('readProviderOverlay', () => {
  it('returns the overlay namespace value when present', async () => {
    const overlay = { 'openai-codex': { displayName: 'ChatGPT' } }
    const namespaces = [{ ns: PROVIDER_OVERLAY_NAMESPACE, value: overlay }]
    const settings = { describe: vi.fn(() => Promise.resolve(okResult({ namespaces }))) } as unknown as SettingsFace
    expect(await readProviderOverlay(settings)).toEqual(overlay)
  })
  it('returns empty when the namespace is absent', async () => {
    const settings = { describe: vi.fn(() => Promise.resolve(okResult({ namespaces: [{ ns: 'other', value: {} }] }))) } as unknown as SettingsFace
    expect(await readProviderOverlay(settings)).toEqual({})
  })
  it('returns empty on not-ok', async () => {
    const settings = { describe: vi.fn(() => Promise.resolve(notOk)) } as unknown as SettingsFace
    expect(await readProviderOverlay(settings)).toEqual({})
  })
  it('returns empty when the transport rejects', async () => {
    const settings = { describe: vi.fn(() => Promise.reject(new Error('down'))) } as unknown as SettingsFace
    expect(await readProviderOverlay(settings)).toEqual({})
  })
})

describe('applyProviderOverlay', () => {
  const providers = [
    { id: 'openai-codex', name: 'OpenAI Codex' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'radius', name: 'Radius' },
  ]
  it('renames, sets a logo, orders, and hides per the overlay', () => {
    const overlay = {
      'openai-codex': { displayName: 'ChatGPT', logo: 'openai', order: 2 },
      anthropic: { displayName: 'Claude', logo: 'anthropic', order: 1 },
      radius: { hidden: true },
    }
    expect(applyProviderOverlay(providers, overlay)).toEqual([
      { id: 'anthropic', name: 'Claude', logo: 'anthropic' },
      { id: 'openai-codex', name: 'ChatGPT', logo: 'openai' },
    ])
  })
  it('keeps the metadata name and no logo when the overlay is empty', () => {
    expect(applyProviderOverlay(providers, {})).toEqual([
      { id: 'openai-codex', name: 'OpenAI Codex' },
      { id: 'anthropic', name: 'Anthropic' },
      { id: 'radius', name: 'Radius' },
    ])
  })
})

describe('probeOAuthStatus', () => {
  it('returns the status value on ok', async () => {
    const oauth = { status: vi.fn(() => Promise.resolve(okResult({ connected: true, type: 'oauth' }))) } as unknown as OauthStatusFace
    expect(await probeOAuthStatus(oauth, 'openai-codex')).toEqual({ connected: true, type: 'oauth' })
  })
  it('returns not-connected on not-ok', async () => {
    const oauth = { status: vi.fn(() => Promise.resolve(notOk)) } as unknown as OauthStatusFace
    expect(await probeOAuthStatus(oauth, 'x')).toEqual({ connected: false })
  })
  it('returns not-connected when the transport rejects', async () => {
    const oauth = { status: vi.fn(() => Promise.reject(new Error('down'))) } as unknown as OauthStatusFace
    expect(await probeOAuthStatus(oauth, 'x')).toEqual({ connected: false })
  })
})

describe('beginConnect', () => {
  it('returns the auth url on ok', async () => {
    const oauth = { begin: vi.fn(() => Promise.resolve(okResult({ authUrl: 'https://a' }))) } as unknown as OauthBeginFace
    expect(await beginConnect(oauth, 'x')).toEqual({ authUrl: 'https://a' })
  })
  it('throws the error message on not-ok', async () => {
    const oauth = { begin: vi.fn(() => Promise.resolve(notOk)) } as unknown as OauthBeginFace
    await expect(beginConnect(oauth, 'x')).rejects.toThrow('no')
  })
})

describe('disconnect', () => {
  it('resolves on ok', async () => {
    const oauth = { logout: vi.fn(() => Promise.resolve(okResult({}))) } as unknown as OauthLogoutFace
    await expect(disconnect(oauth, 'x')).resolves.toBeUndefined()
  })
  it('throws the error message on not-ok', async () => {
    const oauth = { logout: vi.fn(() => Promise.resolve(notOk)) } as unknown as OauthLogoutFace
    await expect(disconnect(oauth, 'x')).rejects.toThrow('no')
  })
})

describe('runOAuthConnect', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  // Flush the begin() promise chain so the first poll timer is scheduled.
  const flush = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

  it('opens the auth url and reports connected once a poll sees the credential', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const oauth = {
      begin: vi.fn(() => Promise.resolve(okResult({ authUrl: 'https://auth' }))),
      status: vi.fn(() => Promise.resolve(okResult({ connected: true, type: 'oauth' }))),
    } as unknown as OauthConnectFace
    const handlers = { onConnecting: vi.fn(), onAuthUrl: vi.fn(), onConnected: vi.fn(), onError: vi.fn() }
    runOAuthConnect(oauth, 'x', handlers)
    expect(handlers.onConnecting).toHaveBeenCalledOnce()
    await flush()
    expect(handlers.onAuthUrl).toHaveBeenCalledWith('https://auth')
    expect(open).toHaveBeenCalledWith('https://auth', '_blank', 'noopener')
    await vi.advanceTimersByTimeAsync(1500)
    expect(handlers.onConnected).toHaveBeenCalledOnce()
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it('polls without an onAuthUrl handler and keeps polling until connected', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    let probes = 0
    const oauth = {
      begin: vi.fn(() => Promise.resolve(okResult({ authUrl: 'https://auth' }))),
      status: vi.fn(() => { probes += 1; return Promise.resolve(okResult({ connected: probes >= 2 })) }),
    } as unknown as OauthConnectFace
    const handlers = { onConnecting: vi.fn(), onConnected: vi.fn(), onError: vi.fn() }
    runOAuthConnect(oauth, 'x', handlers)
    await flush()
    await vi.advanceTimersByTimeAsync(1500)
    expect(handlers.onConnected).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1500)
    expect(handlers.onConnected).toHaveBeenCalledOnce()
  })

  it('reports error when polling reaches the cap without connecting', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const oauth = {
      begin: vi.fn(() => Promise.resolve(okResult({ authUrl: 'https://auth' }))),
      status: vi.fn(() => Promise.resolve(okResult({ connected: false }))),
    } as unknown as OauthConnectFace
    const handlers = { onConnecting: vi.fn(), onAuthUrl: vi.fn(), onConnected: vi.fn(), onError: vi.fn() }
    runOAuthConnect(oauth, 'x', handlers)
    await flush()
    // 80 polls at ~1500 ms each; advance past the cap so onError fires.
    await vi.advanceTimersByTimeAsync(1500 * 81)
    expect(handlers.onConnected).not.toHaveBeenCalled()
    expect(handlers.onError).toHaveBeenCalledOnce()
  })

  it('reports error when begin rejects', async () => {
    const oauth = {
      begin: vi.fn(() => Promise.reject(new Error('denied'))),
      status: vi.fn(() => Promise.resolve(okResult({ connected: false }))),
    } as unknown as OauthConnectFace
    const handlers = { onConnecting: vi.fn(), onAuthUrl: vi.fn(), onConnected: vi.fn(), onError: vi.fn() }
    runOAuthConnect(oauth, 'x', handlers)
    await flush()
    expect(handlers.onError).toHaveBeenCalledOnce()
    expect(handlers.onAuthUrl).not.toHaveBeenCalled()
  })
})

describe('firstModelForProvider', () => {
  it('returns undefined when discovery reports not-ok', async () => {
    const llm = {
      discoverModels: vi.fn(() => Promise.resolve({ result: { ok: false, error: { message: 'no route' } } })),
    } as unknown as LlmFace
    expect(await firstModelForProvider(llm, 'openai-codex')).toBeUndefined()
  })

  it('returns undefined when the transport rejects', async () => {
    const llm = {
      discoverModels: vi.fn(() => Promise.reject(new Error('transport down'))),
    } as unknown as LlmFace
    expect(await firstModelForProvider(llm, 'openai-codex')).toBeUndefined()
  })
})
