/**
 * oauth domain wire methods (oauth.status, oauth.logout, oauth.begin) over createApiProxy:
 * status returns the connection state from the LoginService, logout
 * delegates the disconnect, and begin starts the OAuth flow server-side and
 * returns the auth URL once the LoginService emits it.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import AgentRegistry from '@agentbrain-harness/agent'
import SessionStore from '@agentbrain-harness/session'
import SystemPrompt from '@agentbrain-harness/system-prompt'
import ToolRuntime from '@agentbrain-harness/tools'
import UserQuestionService from '@agentbrain-harness/user-questions'
import LlmRuntime from '@agentbrain-harness/llm'
import type { RpcRequest, RpcResponse } from '../src/api/rpc.ts'
import { RpcId } from '../src/api/rpc.ts'
import { createApiProxy } from '../src/api-proxy.ts'
import type { OAuthLoginServiceFace } from '../src/api-proxy.ts'

const DEFAULTS = { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' }

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`req-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function expectErr<T>(response: RpcResponse<T>): { code: string; message: string; details: unknown } {
  expect(response.result.ok).toBe(false)
  if (response.result.ok) throw new Error('unreachable')
  return response.result.error
}

async function harness(loginService?: OAuthLoginServiceFace, beginUrlTimeoutMs?: number): Promise<ReturnType<typeof createApiProxy>> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LlmRuntime)
  ctx.provide('workspaceRegistry', { list: () => [] } as never)
  return createApiProxy(ctx, {
    ...DEFAULTS,
    ...(loginService === undefined ? {} : { loginService }),
    ...(beginUrlTimeoutMs === undefined ? {} : { beginUrlTimeoutMs }),
  })
}

describe('oauth domain', () => {
  it('lists providers from the loginService', async () => {
    const loginService: OAuthLoginServiceFace = {
      providers: () => [{ id: 'openai-codex', name: 'OpenAI Codex' }],
      logout: vi.fn(), status: vi.fn(), begin: vi.fn(),
    }
    const api = await harness(loginService)
    const value = expectOk(await api.oauth.providers(request({})))
    expect(value).toEqual({ providers: [{ id: 'openai-codex', name: 'OpenAI Codex' }] })
  })

  it('lists no providers when no loginService is mounted', async () => {
    const api = await harness()
    const value = expectOk(await api.oauth.providers(request({})))
    expect(value).toEqual({ providers: [] })
  })

  it('reports an actionable internal error when no loginService is provided (status)', async () => {
    const api = await harness()
    const error = expectErr(await api.oauth.status(request({ providerId: 'openai-codex' })))
    expect(error.code).toBe('internal')
    expect(error.message).toContain('oauth')
  })

  it('reports connected status from the loginService when a credential is stored', async () => {
    const status = vi.fn().mockResolvedValue({ connected: true, type: 'oauth' })
    const loginService: OAuthLoginServiceFace = {
      providers: () => [], logout: vi.fn(), status, begin: vi.fn() }
    const api = await harness(loginService)
    const value = expectOk(await api.oauth.status(request({ providerId: 'openai-codex' })))
    expect(value).toEqual({ connected: true, type: 'oauth' })
    expect(status).toHaveBeenCalledWith('openai-codex')
  })

  it('reports not-connected when the loginService returns no credential', async () => {
    const loginService: OAuthLoginServiceFace = {
      providers: () => [],
      logout: vi.fn(),
      status: vi.fn().mockResolvedValue({ connected: false }),
      begin: vi.fn(),
    }
    const api = await harness(loginService)
    const value = expectOk(await api.oauth.status(request({ providerId: 'openai-codex' })))
    expect(value).toEqual({ connected: false })
  })

  it('delegates logout to the loginService and returns empty ok', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const loginService: OAuthLoginServiceFace = {
      providers: () => [], logout, status: vi.fn(), begin: vi.fn() }
    const api = await harness(loginService)
    const value = expectOk(await api.oauth.logout(request({ providerId: 'openai-codex' })))
    expect(value).toEqual({})
    expect(logout).toHaveBeenCalledWith('openai-codex')
  })

  it('reports an actionable internal error when no loginService is provided (logout)', async () => {
    const api = await harness()
    const error = expectErr(await api.oauth.logout(request({ providerId: 'openai-codex' })))
    expect(error.code).toBe('internal')
    expect(error.message).toContain('oauth')
  })

  it('begin resolves with the auth URL when the loginService emits an auth_url event', async () => {
    const begin = vi.fn().mockImplementation((_providerId: string, interaction: { notify(event: { type: string; url: string }): void }) => {
      interaction.notify({ type: 'auth_url', url: 'http://x/authorize' })
      return Promise.resolve()
    })
    const loginService: OAuthLoginServiceFace = {
      providers: () => [], logout: vi.fn(), status: vi.fn(), begin }
    const api = await harness(loginService)
    const value = expectOk(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    expect(value).toEqual({ authUrl: 'http://x/authorize' })
    expect(begin).toHaveBeenCalledWith('openai-codex', expect.objectContaining({ notify: expect.any(Function) as unknown }))
  })

  // The begin handler builds the AuthInteraction; these tests capture it, let
  // begin resolve by emitting auth_url, then drive its prompt directly. begin
  // stays pending like the real loopback flow (resolves on its callback).
  type ProbePrompt = { type: string; options?: readonly { id: string }[]; signal?: AbortSignal }
  type ProbeInteraction = { prompt(p: ProbePrompt): Promise<string> }
  function captureBeginInteraction(): { loginService: OAuthLoginServiceFace; interaction: () => ProbeInteraction } {
    let captured: ProbeInteraction | undefined
    const loginService: OAuthLoginServiceFace = {
      providers: () => [],
      logout: vi.fn(),
      status: vi.fn(),
      begin: vi.fn().mockImplementation((_id: string, i: ProbeInteraction & { notify(e: { type: string; url: string }): void }) => {
        captured = i
        i.notify({ type: 'auth_url', url: 'http://x/authorize' })
        return new Promise(() => undefined)
      }),
    }
    return {
      loginService,
      interaction: () => {
        if (captured === undefined) throw new Error('begin never received the interaction')
        return captured
      },
    }
  }

  it('begin answers the openai-codex login-method select prompt with the browser option', async () => {
    const { loginService, interaction } = captureBeginInteraction()
    const api = await harness(loginService)
    expectOk(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    const choice = await interaction().prompt({ type: 'select', options: [{ id: 'browser' }, { id: 'device_code' }] })
    expect(choice).toBe('browser')
  })

  it('begin leaves a signalled fallback prompt pending until its callback aborts it', async () => {
    const { loginService, interaction } = captureBeginInteraction()
    const api = await harness(loginService)
    expectOk(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    const controller = new AbortController()
    const pending = interaction().prompt({ type: 'manual_code', signal: controller.signal })
    const raced = await Promise.race([pending.then(() => 'settled', () => 'settled'), Promise.resolve('pending')])
    expect(raced).toBe('pending')
    controller.abort()
    await expect(pending).rejects.toThrow('aborted')
  })

  it('begin rejects a fallback prompt whose signal is already aborted', async () => {
    const { loginService, interaction } = captureBeginInteraction()
    const api = await harness(loginService)
    expectOk(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    await expect(interaction().prompt({ type: 'manual_code', signal: AbortSignal.abort() })).rejects.toThrow('aborted')
  })

  it('begin rejects a prompt it cannot answer over the poll-based wire', async () => {
    const { loginService, interaction } = captureBeginInteraction()
    const api = await harness(loginService)
    expectOk(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    await expect(interaction().prompt({ type: 'text' })).rejects.toThrow('not supported')
  })

  it('returns a structured timeout error when the loginService never emits an auth_url event', async () => {
    const loginService: OAuthLoginServiceFace = {
      providers: () => [],
      logout: vi.fn(),
      status: vi.fn(),
      // begin never calls interaction.notify — simulates a flow that never yields a URL.
      begin: vi.fn().mockReturnValue(new Promise(() => undefined)),
    }
    const api = await harness(loginService, 50)
    const error = expectErr(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    expect(error.code).toBe('internal')
    expect(error.message).toMatch(/timed out/)
  })

  it('returns a structured error when the login flow rejects (provider failure, rate limit)', async () => {
    const loginService: OAuthLoginServiceFace = {
      providers: () => [],
      logout: vi.fn(),
      status: vi.fn(),
      begin: vi.fn().mockRejectedValue(new Error('device authorization rate limited')),
    }
    const api = await harness(loginService)
    const error = expectErr(await api.oauth.begin(request({ providerId: 'github-copilot' })))
    expect(error.code).toBe('internal')
    expect(error.message).toBe('device authorization rate limited')
  })

  it('reports an actionable internal error when no loginService is provided (begin)', async () => {
    const api = await harness()
    const error = expectErr(await api.oauth.begin(request({ providerId: 'openai-codex' })))
    expect(error.code).toBe('internal')
    expect(error.message).toContain('oauth')
  })
})
