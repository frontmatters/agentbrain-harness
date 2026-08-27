/**
 * Unit coverage for {@link createOAuthLoginService}: the login face resolves the
 * authorization and credentials seams at call time, so it is exercised here with
 * a fake context that supplies, withholds, or partially supplies those seams.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@agentbrain-harness/cordis'
import { createOAuthLoginService } from '../src/index.ts'

/** A context whose `get` returns exactly the named services provided. */
function ctxWith(services: Record<string, unknown>): Context {
  return { get: (name: string) => services[name] } as unknown as Context
}

const CODEX_KEY = 'llm-pi-ai/openai-codex'

function fakeAuth(overrides: Partial<{ keys: string[]; begin: ReturnType<typeof vi.fn>; entries: unknown[] }> = {}) {
  const entries = overrides.entries
    ?? (overrides.keys ?? [CODEX_KEY]).map(key => ({ key, label: key, methods: [{ id: 'oauth', label: 'x' }] }))
  return {
    list: () => entries,
    begin: overrides.begin ?? vi.fn(() => Promise.resolve()),
  }
}

function fakeCreds(overrides: Partial<{
  readRecord: ReturnType<typeof vi.fn>
  deleteRecord: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    readRecord: overrides.readRecord ?? vi.fn(() => Promise.resolve(undefined)),
    deleteRecord: overrides.deleteRecord ?? vi.fn(() => Promise.resolve()),
  }
}

const noopInteraction = { notify: vi.fn(), prompt: vi.fn() }

describe('createOAuthLoginService', () => {
  it('providers is empty when the authorization seam is absent', () => {
    const svc = createOAuthLoginService(ctxWith({}))
    expect(svc.providers()).toEqual([])
  })

  it('providers lists only oauth-capable flows with their metadata names', () => {
    const entries = [
      { key: 'llm-pi-ai/openai-codex', label: 'OpenAI Codex', methods: [{ id: 'oauth', label: 'x' }] },
      { key: 'llm-pi-ai/deepseek', label: 'DeepSeek', methods: [{ id: 'api-key', label: 'y' }] },
      { key: 'llm-pi-ai/anthropic', label: 'Anthropic', methods: [{ id: 'api-key', label: 'y' }, { id: 'oauth', label: 'x' }] },
    ]
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth({ entries }), credentials: fakeCreds() }))
    expect(svc.providers()).toEqual([
      { id: 'openai-codex', name: 'OpenAI Codex' },
      { id: 'anthropic', name: 'Anthropic' },
    ])
  })

  it('begin rejects when the seams are not mounted', async () => {
    const svc = createOAuthLoginService(ctxWith({}))
    await expect(svc.begin('openai-codex', noopInteraction)).rejects.toThrow(/not mounted/)
  })

  it('begin rejects when only one seam is mounted', async () => {
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth() }))
    await expect(svc.begin('openai-codex', noopInteraction)).rejects.toThrow(/not mounted/)
  })

  it('begin rejects when no flow is registered for the provider', async () => {
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth({ keys: [] }), credentials: fakeCreds() }))
    await expect(svc.begin('openai-codex', noopInteraction)).rejects.toThrow(/no authorization flow/)
  })

  it('begin runs the flow and relays notices and prompts to the caller', async () => {
    const notify = vi.fn()
    const prompt = vi.fn(() => Promise.resolve('browser'))
    const begin = vi.fn(async (request: {
      interaction: {
        notify: (event: { url?: string }) => void
        prompt: (prompt: { kind: string; options?: unknown; signal?: AbortSignal }) => Promise<string>
      }
    }) => {
      request.interaction.notify({ url: 'https://provider/authorize' })
      request.interaction.notify({})
      await request.interaction.prompt({ kind: 'select', options: [{ id: 'browser' }], signal: new AbortController().signal })
      await request.interaction.prompt({ kind: 'text' })
    })
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth({ begin }), credentials: fakeCreds() }))

    await expect(svc.begin('openai-codex', { notify, prompt })).resolves.toBeUndefined()
    expect(begin).toHaveBeenCalledWith(expect.objectContaining({ key: CODEX_KEY, method: 'oauth' }))
    expect(notify).toHaveBeenCalledWith({ type: 'auth_url', url: 'https://provider/authorize' })
    expect(notify).toHaveBeenCalledWith({ type: 'info' })
    expect(prompt).toHaveBeenCalledWith(expect.objectContaining({ type: 'select', options: [{ id: 'browser' }] }))
    expect(prompt).toHaveBeenCalledWith({ type: 'text' })
  })

  it('status reports not-connected when the seams are absent', async () => {
    const svc = createOAuthLoginService(ctxWith({}))
    expect(await svc.status('openai-codex')).toEqual({ connected: false })
  })

  it('status reports not-connected when no flow is registered', async () => {
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth({ keys: [] }), credentials: fakeCreds() }))
    expect(await svc.status('openai-codex')).toEqual({ connected: false })
  })

  it('status reports not-connected when no credential record exists', async () => {
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth(), credentials: fakeCreds() }))
    expect(await svc.status('openai-codex')).toEqual({ connected: false })
  })

  it('status reports connected with the record kind when a credential exists', async () => {
    const readRecord = vi.fn(() => Promise.resolve({ kind: 'grant' }))
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth(), credentials: fakeCreds({ readRecord }) }))
    expect(await svc.status('openai-codex')).toEqual({ connected: true, type: 'grant' })
    expect(readRecord).toHaveBeenCalledWith(CODEX_KEY)
  })

  it('logout is a no-op when the seams are absent', async () => {
    const svc = createOAuthLoginService(ctxWith({}))
    await expect(svc.logout('openai-codex')).resolves.toBeUndefined()
  })

  it('logout deletes the credential record for a registered provider', async () => {
    const deleteRecord = vi.fn(() => Promise.resolve())
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth(), credentials: fakeCreds({ deleteRecord }) }))
    await svc.logout('openai-codex')
    expect(deleteRecord).toHaveBeenCalledWith(CODEX_KEY)
  })

  it('logout is a no-op when no flow is registered', async () => {
    const deleteRecord = vi.fn(() => Promise.resolve())
    const svc = createOAuthLoginService(ctxWith({ authorization: fakeAuth({ keys: [] }), credentials: fakeCreds({ deleteRecord }) }))
    await svc.logout('openai-codex')
    expect(deleteRecord).not.toHaveBeenCalled()
  })
})
