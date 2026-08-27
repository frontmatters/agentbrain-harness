// @vitest-environment jsdom
/** The Models page default-model control: catalog listing, switch, empty, error. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IApiClient } from '@agentbrain-harness/api-remotes/client'
import { DefaultModelControl, resolveProviderModels } from '../src/client/DefaultModelControl.tsx'
import type { ModelsSettingsStore, RouteDiscovery } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

let nextRpc = 0
const ok = <T,>(value: T) => ({ rpcId: `c-${nextRpc++}` as never, result: { ok: true as const, value } })
const fail = (message: string) =>
  ({ rpcId: `c-${nextRpc++}` as never, result: { ok: false as const, error: { code: 'internal', message, details: {} } } })

const nsView = (ns: string, revision: number) =>
  ({ ns, schema: {}, value: {}, applies: 'live' as const, secrets: [], revision })

function makeApi(options: {
  groups?: { id: string; name: string; models: { id: string; name: string }[] }[]
  modelsReject?: boolean
  mutateFail?: boolean
  discovered?: string[]
  discoverReject?: boolean
} = {}) {
  const mutate = vi.fn(() =>
    options.mutateFail === true
      ? Promise.resolve(fail('rejected'))
      : Promise.resolve(ok(nsView('agent-default-model', 1))))
  const api = {
    llm: {
      models: () => options.modelsReject === true
        ? Promise.reject(new Error('catalog down'))
        : Promise.resolve(ok({ groups: options.groups ?? [], failures: [] })),
      discoverModels: () => options.discoverReject === true
        ? Promise.reject(new Error('probe refused'))
        : Promise.resolve(ok({ models: (options.discovered ?? []).map(id => ({ id })) })),
    },
    settings: {
      describe: () => Promise.resolve(ok({
        writable: true, hasDocument: false, namespaces: [nsView('agent-default-model', 0)],
      })),
      mutate,
    },
  }
  return { api: api as unknown as Pick<IApiClient, 'settings' | 'llm'>, mutate }
}

const localGroup = { id: 'local', name: 'Local (Ollama)', models: [{ id: 'qwen', name: 'qwen' }, { id: 'phi', name: 'phi' }] }

function controllerWithLoad(load: () => Promise<void>): ModelsSettingsStore {
  return { load } as unknown as ModelsSettingsStore
}

const CURRENT = { provider: 'local', model: 'qwen' }

function renderControl(
  api: Pick<IApiClient, 'settings' | 'llm'>,
  current: { provider: string; model: string } | undefined,
  controller: ModelsSettingsStore = controllerWithLoad(vi.fn()),
  discover?: RouteDiscovery,
): ReturnType<typeof render> {
  return render(
    <DefaultModelControl
      api={api}
      controller={controller}
      t={key => en[key]}
      {...current === undefined ? {} : { current }}
      {...discover === undefined ? {} : { discover }}
    />,
  )
}

describe('DefaultModelControl', () => {
  it('renders nothing when no default is set', () => {
    const { api } = makeApi()
    const { container } = renderControl(api, undefined)
    expect(container.firstChild).toBeNull()
  })

  it('lists the provider catalog models and reflects the current default', async () => {
    const { api } = makeApi({ groups: [localGroup] })
    renderControl(api, CURRENT)
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect([...select.options].map(option => option.value)).toContain('phi') })
    expect(select.value).toBe('qwen')
  })

  it('writes the picked model as the new default and reloads', async () => {
    const load = vi.fn(() => Promise.resolve())
    const { api, mutate } = makeApi({ groups: [localGroup] })
    renderControl(api, CURRENT, controllerWithLoad(load))
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect(select.disabled).toBe(false) })
    fireEvent.change(select, { target: { value: 'phi' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ ns: 'agent-default-model' })) })
    await waitFor(() => { expect(load).toHaveBeenCalled() })
  })

  it('keeps the current model selectable when the catalog is empty', async () => {
    const { api } = makeApi({ groups: [] })
    renderControl(api, CURRENT)
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect([...select.options].map(option => option.value)).toEqual(['qwen']) })
  })

  it('lists the live-probed models when discovery answers', async () => {
    const { api } = makeApi({ discovered: ['qwen', 'phi', 'llama3.3'], groups: [] })
    const discover: RouteDiscovery = { settingsNs: 'llm-pi-ai', baseURL: 'http://localhost:11434/v1', api: 'openai-completions' }
    renderControl(api, CURRENT, controllerWithLoad(vi.fn()), discover)
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect([...select.options].map(option => option.value)).toContain('llama3.3') })
  })

  it('reports a failed save and does not reload', async () => {
    const load = vi.fn(() => Promise.resolve())
    const { api } = makeApi({ groups: [localGroup], mutateFail: true })
    renderControl(api, CURRENT, controllerWithLoad(load))
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect(select.disabled).toBe(false) })
    fireEvent.change(select, { target: { value: 'phi' } })
    expect(await screen.findByText(en.defaultModelSaveFailed)).toBeTruthy()
    expect(load).not.toHaveBeenCalled()
  })

  it('falls back to only the current model when the catalog read rejects', async () => {
    const { api } = makeApi({ modelsReject: true })
    renderControl(api, CURRENT)
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect([...select.options].map(option => option.value)).toEqual(['qwen']) })
  })

  it('does not write when the picked model equals the current default', async () => {
    const { api, mutate } = makeApi({ groups: [localGroup] })
    renderControl(api, CURRENT)
    const select = await screen.findByLabelText<HTMLSelectElement>(/Default model/)
    await waitFor(() => { expect(select.disabled).toBe(false) })
    fireEvent.change(select, { target: { value: 'qwen' } })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('names the provider in the control label', async () => {
    const { api } = makeApi({ groups: [localGroup] })
    render(
      <DefaultModelControl
        api={api}
        controller={controllerWithLoad(vi.fn())}
        current={CURRENT}
        providerLabel="Local (Ollama)"
        t={key => en[key]}
      />,
    )
    expect(await screen.findByLabelText(/Local \(Ollama\)/)).toBeTruthy()
  })
})

const DISCOVER: RouteDiscovery = { settingsNs: 'llm-pi-ai', baseURL: 'http://localhost:11434/v1', api: 'openai-completions' }

describe('resolveProviderModels', () => {
  it('returns the live-probed models when discovery answers', async () => {
    const { api } = makeApi({ discovered: ['a', 'b'], groups: [{ id: 'local', name: 'L', models: [{ id: 'x', name: 'x' }] }] })
    expect(await resolveProviderModels(api.llm, 'local', DISCOVER)).toEqual(['a', 'b'])
  })

  it('falls back to the catalog when discovery is empty', async () => {
    const { api } = makeApi({ discovered: [], groups: [{ id: 'local', name: 'L', models: [{ id: 'x', name: 'x' }] }] })
    expect(await resolveProviderModels(api.llm, 'local', DISCOVER)).toEqual(['x'])
  })

  it('falls back to the catalog when the probe rejects', async () => {
    const { api } = makeApi({ discoverReject: true, groups: [{ id: 'local', name: 'L', models: [{ id: 'x', name: 'x' }] }] })
    expect(await resolveProviderModels(api.llm, 'local', DISCOVER)).toEqual(['x'])
  })

  it('reads the catalog when no discovery params are given', async () => {
    const { api } = makeApi({ groups: [{ id: 'local', name: 'L', models: [{ id: 'x', name: 'x' }] }] })
    expect(await resolveProviderModels(api.llm, 'local', undefined)).toEqual(['x'])
  })

  it('probes without a protocol when the route names none', async () => {
    const { api } = makeApi({ discovered: ['a'] })
    expect(await resolveProviderModels(api.llm, 'local', { settingsNs: 'llm-pi-ai', baseURL: 'http://x/v1' })).toEqual(['a'])
  })

  it('returns empty when the catalog result is not ok', async () => {
    const llm = { models: () => Promise.resolve(fail('down')), discoverModels: () => Promise.resolve(ok({ models: [] })) }
    expect(await resolveProviderModels((llm as never), 'local', undefined)).toEqual([])
  })

  it('returns empty when the catalog transport rejects', async () => {
    const { api } = makeApi({ modelsReject: true })
    expect(await resolveProviderModels(api.llm, 'local', undefined)).toEqual([])
  })
})
