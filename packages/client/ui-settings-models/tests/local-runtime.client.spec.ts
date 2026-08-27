import { describe, expect, it, vi } from 'vitest'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'
import {
  DEFAULT_LOCAL_BASE_URL, LOCAL_API, LOCAL_ROUTE, PI_AI_NAMESPACE, probeLocalRuntime, writeLocalRoute,
} from '../src/client/local-runtime.ts'

type Discover = IApiClient['llm']['discoverModels']
type Describe = IApiClient['settings']['describe']
type Mutate = IApiClient['settings']['mutate']

function llm(discoverModels: Discover): Pick<IApiClient['llm'], 'discoverModels'> {
  return { discoverModels }
}

const ok = (models: { id: string }[]) =>
  ({ rpcId: 'probe' as never, result: { ok: true as const, value: { models } } })
const fail = (message: string) =>
  ({ rpcId: 'probe' as never, result: { ok: false as const, error: { code: 'internal', message, details: {} } } })

describe('probeLocalRuntime', () => {
  it('probes the default local endpoint keylessly and reports its models', async () => {
    const discover = vi.fn(() => Promise.resolve(ok([{ id: 'llama3.3' }, { id: 'qwen2.5' }])))
    const runtime = await probeLocalRuntime(llm(discover))
    expect(runtime).toEqual({ available: true, models: ['llama3.3', 'qwen2.5'] })
    expect(discover).toHaveBeenCalledWith({
      settingsNs: PI_AI_NAMESPACE, baseURL: DEFAULT_LOCAL_BASE_URL, api: LOCAL_API,
    })
  })

  it('forwards a custom baseURL so it is reusable against any local endpoint', async () => {
    const discover = vi.fn(() => Promise.resolve(ok([{ id: 'phi4' }])))
    const runtime = await probeLocalRuntime(llm(discover), 'http://localhost:1234/v1')
    expect(runtime).toEqual({ available: true, models: ['phi4'] })
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'http://localhost:1234/v1' }))
  })

  it('reports unavailable when the listing is empty', async () => {
    const runtime = await probeLocalRuntime(llm(() =>
      Promise.resolve(ok([]))))
    expect(runtime).toEqual({ available: false, models: [] })
  })

  it('reports unavailable when the probe returns an error result', async () => {
    const runtime = await probeLocalRuntime(llm((() =>
      Promise.resolve(fail('connection refused'))) as unknown as Discover))
    expect(runtime).toEqual({ available: false, models: [] })
  })

  it('reports unavailable when the transport rejects', async () => {
    const runtime = await probeLocalRuntime(llm(() =>
      Promise.reject(new Error('offline'))))
    expect(runtime).toEqual({ available: false, models: [] })
  })
})

const nsView = (ns: string, revision: number) =>
  ({ ns, schema: {}, value: {}, applies: 'live' as const, secrets: [], revision })
const describeOk = (namespaces: ReturnType<typeof nsView>[]) =>
  ({ rpcId: 'd' as never, result: { ok: true as const, value: { writable: true, hasDocument: true, namespaces } } })
const mutateOk = () =>
  ({ rpcId: 'm' as never, result: { ok: true as const, value: nsView(PI_AI_NAMESPACE, 1) } })

function settings(describe: Describe, mutate: Mutate): Pick<IApiClient['settings'], 'describe' | 'mutate'> {
  return { describe, mutate }
}

describe('writeLocalRoute', () => {
  it('writes a keyless local route with the chosen model under the pi-ai revision', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk()))
    const describe = (() => Promise.resolve(describeOk([nsView(PI_AI_NAMESPACE, 7)]))) as unknown as Describe
    const result = await writeLocalRoute(settings(describe, mutate), { model: 'llama3.3' })
    expect(result).toEqual({ ok: true })
    expect(mutate).toHaveBeenCalledWith({
      ns: PI_AI_NAMESPACE,
      ops: [{
        op: 'set',
        path: ['providers', LOCAL_ROUTE],
        value: {
          displayName: 'Local (Ollama)',
          api: LOCAL_API,
          baseURL: DEFAULT_LOCAL_BASE_URL,
          headers: { Authorization: 'Bearer local' },
          models: [{ id: 'llama3.3' }],
        },
      }],
      expectedRevision: 7,
    })
  })

  it('records a custom endpoint when supplied', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk()))
    const describe = (() => Promise.resolve(describeOk([nsView(PI_AI_NAMESPACE, 0)]))) as unknown as Describe
    await writeLocalRoute(settings(describe, mutate), { model: 'phi4', baseURL: 'http://localhost:1234/v1' })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      ops: [expect.objectContaining({ value: expect.objectContaining({ baseURL: 'http://localhost:1234/v1' }) as unknown })],
    }))
  })
})
