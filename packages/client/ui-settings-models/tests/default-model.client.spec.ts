import { describe, expect, it, vi } from 'vitest'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'
import { AGENT_DEFAULT_MODEL_NAMESPACE, writeDefaultModel } from '../src/client/default-model.ts'

type Describe = IApiClient['settings']['describe']
type Mutate = IApiClient['settings']['mutate']

function settings(describe: Describe, mutate: Mutate): Pick<IApiClient['settings'], 'describe' | 'mutate'> {
  return { describe, mutate }
}

const namespaceView = (ns: string, revision: number) =>
  ({ ns, schema: {}, value: {}, applies: 'live' as const, secrets: [], revision })

const describeOk = (namespaces: ReturnType<typeof namespaceView>[]) =>
  ({ rpcId: 'd' as never, result: { ok: true as const, value: { writable: true, hasDocument: true, namespaces } } })
const describeFail = (message: string) =>
  ({ rpcId: 'd' as never, result: { ok: false as const, error: { code: 'internal', message, details: {} } } })

const mutateOk = (revision: number) =>
  ({ rpcId: 'm' as never, result: { ok: true as const, value: namespaceView(AGENT_DEFAULT_MODEL_NAMESPACE, revision) } })
const mutateFail = (code: string, message: string) =>
  ({ rpcId: 'm' as never, result: { ok: false as const, error: { code, message, details: {} } } })

describe('writeDefaultModel', () => {
  it('mutates provider and model under the described revision', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk(4)))
    const describe = (() =>
      Promise.resolve(describeOk([namespaceView(AGENT_DEFAULT_MODEL_NAMESPACE, 3)]))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: true })
    expect(mutate).toHaveBeenCalledWith({
      ns: AGENT_DEFAULT_MODEL_NAMESPACE,
      ops: [
        { op: 'set', path: ['provider'], value: 'local' },
        { op: 'set', path: ['model'], value: 'llama3.3' },
      ],
      expectedRevision: 3,
    })
  })

  it('includes reasoningEffort when supplied', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk(1)))
    const describe = (() =>
      Promise.resolve(describeOk([namespaceView(AGENT_DEFAULT_MODEL_NAMESPACE, 0)]))) as unknown as Describe
    await writeDefaultModel(settings(describe, mutate), { provider: 'default', model: 'gpt-5', reasoningEffort: 'high' })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      ops: [
        { op: 'set', path: ['provider'], value: 'default' },
        { op: 'set', path: ['model'], value: 'gpt-5' },
        { op: 'set', path: ['reasoningEffort'], value: 'high' },
      ],
    }))
  })

  it('reports namespace-absent when the section is not installed', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk(1)))
    const describe = (() => Promise.resolve(describeOk([namespaceView('llm-pi-ai', 2)]))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: false, reason: 'namespace-absent', message: expect.any(String) as unknown })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('maps a settings-conflict to the conflict reason', async () => {
    const mutate = (() => Promise.resolve(mutateFail('settings-conflict', 'stale'))) as unknown as Mutate
    const describe = (() =>
      Promise.resolve(describeOk([namespaceView(AGENT_DEFAULT_MODEL_NAMESPACE, 3)]))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: false, reason: 'conflict', message: 'stale' })
  })

  it('reports error when describe fails', async () => {
    const mutate = vi.fn(() => Promise.resolve(mutateOk(1)))
    const describe = (() => Promise.resolve(describeFail('offline'))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: false, reason: 'error', message: 'offline' })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('reports error when the describe transport rejects', async () => {
    const mutate = (() => Promise.resolve(mutateOk(1))) as unknown as Mutate
    const describe = (() => Promise.reject(new Error('boom'))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: false, reason: 'error', message: 'boom' })
  })

  it('reports error when the mutate transport rejects with a non-Error value', async () => {
    // A host or runtime can reject with anything; the writer still has to say
    // something, so a non-Error rejection is stringified rather than dropped.
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- drives the non-Error rejection path
    const mutate = (() => Promise.reject('raw fault')) as unknown as Mutate
    const describe = (() =>
      Promise.resolve(describeOk([namespaceView(AGENT_DEFAULT_MODEL_NAMESPACE, 3)]))) as unknown as Describe
    const result = await writeDefaultModel(settings(describe, mutate), { provider: 'local', model: 'llama3.3' })
    expect(result).toEqual({ ok: false, reason: 'error', message: 'raw fault' })
  })
})
