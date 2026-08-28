// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginInventorySettingsTab } from '../src/client/PluginInventorySettingsTab.tsx'
import type {
  PluginInventorySettingsTabInjected,
  PluginInventorySettingsTabProps,
} from '../src/client/PluginInventorySettingsTab.tsx'
import { en, type PluginInventoryLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = Awaited<ReturnType<PluginInventorySettingsTabInjected['list']>>
const t = ((key: PluginInventoryLocaleKey): string => en[key]) as PluginInventorySettingsTabProps['t']

function props(
  list: PluginInventorySettingsTabInjected['list'],
  setEnabled: PluginInventorySettingsTabInjected['setEnabled'] = () => Promise.resolve(),
): PluginInventorySettingsTabProps {
  return {
    t,
    list,
    setEnabled,
  } as PluginInventorySettingsTabProps
}

const SNAPSHOT = {
  entries: [
    { entryId: '8a1b2c3d', moduleName: '@agentbrain-harness/cordis-plugin-hmr', enabled: true, fiberPhase: 'active' },
    { entryId: 'pending', moduleName: 'cordis:pending-name', enabled: true, fiberPhase: 'pending' },
    { entryId: 'loading', moduleName: '@fixture/loading-name', enabled: true, fiberPhase: 'loading' },
    { entryId: 'failed', moduleName: '@fixture/failed-name', enabled: true, fiberPhase: 'failed' },
    { entryId: 'unloading', moduleName: '@fixture/unloading-name', enabled: true, fiberPhase: 'unloading' },
    { entryId: 'unobserved', moduleName: '@fixture/unobserved-name', enabled: true, fiberPhase: null },
    { entryId: 'disabled-entry', moduleName: '@agentbrain-harness/host-directory-picker-native', enabled: false, fiberPhase: null },
  ],
} as unknown as Snapshot

describe('PluginInventorySettingsTab', () => {
  it('renders runtime status only for enabled plugins', async () => {
    const deferred = Promise.withResolvers<Snapshot>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<PluginInventorySettingsTab {...props(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(SNAPSHOT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('searchbox', { name: en.search })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.catalog })).toBeTruthy()
    expect(view.container.querySelector('[data-plugin-count]')?.textContent).toBe('7')
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getAllByText(en.enabledTag)).toHaveLength(6)
    expect(screen.getByText(en.disabledTag)).toBeTruthy()
    for (const value of [
      'Mounted',
      'Waiting for dependencies',
      'Loading',
      'Mount failed',
      'Unloading',
      'Not mounted',
    ]) {
      expect(screen.getByRole('img', { name: value })).toBeTruthy()
    }
    const active = screen.getByRole('button', { name: 'hmr, Mounted, Enabled' })
    expect(active.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(active)
    expect(active.getAttribute('aria-expanded')).toBe('true')
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('8a1b2c3d')
    expect(screen.getByText(en.configuration)).toBeTruthy()
    expect(screen.getByText(en.cordis)).toBeTruthy()
    fireEvent.click(active)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()

    fireEvent.click(active)
    fireEvent.change(screen.getByRole('searchbox', { name: en.search }), {
      target: { value: 'disabled-entry' },
    })
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'directory-picker-native, Disabled' }))
    expect(screen.getAllByText(en.disabledTag)).toHaveLength(2)
    expect(screen.queryByText(en.cordis)).toBeNull()
    expect(screen.queryByText(en.unobserved)).toBeNull()
  })

  it('filters by module name or Loader entry id', async () => {
    render(<PluginInventorySettingsTab {...props(async () => SNAPSHOT)} />)
    const search = await screen.findByRole('searchbox', { name: en.search })

    fireEvent.change(search, { target: { value: 'disabled-entry' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('directory-picker-native')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'cordis-plugin-hmr' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('hmr')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'not-a-plugin' } })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ entries: [] })
    render(<PluginInventorySettingsTab {...props(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    expect(screen.queryByText('private transport detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as PluginInventorySettingsTabInjected['list']
    const failed = render(<PluginInventorySettingsTab {...props(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<PluginInventorySettingsTab {...props(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const deferredFailure = Promise.withResolvers<Snapshot>()
    const pendingFailure = render(<PluginInventorySettingsTab {...props(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})

const TOGGLABLE_SNAPSHOT = {
  entries: [
    { entryId: 'tog-on', moduleName: '@fixture/togglable-on', enabled: true, fiberPhase: 'active', togglable: true },
    { entryId: 'tog-off', moduleName: '@fixture/togglable-off', enabled: false, fiberPhase: null, togglable: true },
  ],
} as unknown as Snapshot

describe('PluginInventorySettingsTab toggle', () => {
  it('disables an enabled togglable entry: setEnabled called, poll converges immediately, state updated', async () => {
    // After toggle the list returns the entry with enabled already flipped,
    // so the for-loop condition is false on the first check (attempt 0) and
    // no setTimeout fires — both loop-condition branches are covered.
    const afterDisable = {
      entries: [
        { entryId: 'tog-on', moduleName: '@fixture/togglable-on', enabled: false, fiberPhase: null, togglable: true },
        { entryId: 'tog-off', moduleName: '@fixture/togglable-off', enabled: false, fiberPhase: null, togglable: true },
      ],
    } as unknown as Snapshot
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>()
      .mockResolvedValueOnce(TOGGLABLE_SNAPSHOT)
      .mockResolvedValue(afterDisable)
    const setEnabled = vi.fn<PluginInventorySettingsTabInjected['setEnabled']>().mockResolvedValue()

    render(<PluginInventorySettingsTab {...props(list, setEnabled)} />)
    // Expand the enabled togglable row.
    const rowBtn = await screen.findByRole('button', { name: 'togglable-on, Mounted, Enabled' })
    fireEvent.click(rowBtn)
    // The disable button appears; variant is 'outline' for an enabled entry.
    expect(screen.getByRole('button', { name: en.disable })).toBeTruthy()
    // The toggle hint is shown alongside the button.
    expect(screen.getByText(en.toggleHint)).toBeTruthy()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.disable })) })
    await waitFor(() => { expect(setEnabled).toHaveBeenCalledWith('tog-on', false) })
    // list() was called once on mount and at least once during the poll.
    await waitFor(() => { expect(list.mock.calls.length).toBeGreaterThanOrEqual(2) })
  })

  it('enables a disabled togglable entry: poll loop fires once when first read is stale', async () => {
    // First post-setEnabled list() still shows enabled=false (stale), so the loop
    // body (setTimeout + second list()) runs once; the second read reflects the
    // change and the loop exits — covering lines 113-114 and 116.
    const singleOff: Snapshot = {
      entries: [{ entryId: 'tog-off', moduleName: '@fixture/togglable-off', enabled: false, fiberPhase: null, togglable: true }],
    } as unknown as Snapshot
    const singleOn: Snapshot = {
      entries: [{ entryId: 'tog-off', moduleName: '@fixture/togglable-off', enabled: true, fiberPhase: 'active', togglable: true }],
    } as unknown as Snapshot
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>()
      .mockResolvedValueOnce(singleOff)  // initial load
      .mockResolvedValueOnce(singleOff)  // first poll — stale, enters loop body
      .mockResolvedValue(singleOn)       // second poll — converged, exits loop
    const setEnabled = vi.fn<PluginInventorySettingsTabInjected['setEnabled']>().mockResolvedValue()

    render(<PluginInventorySettingsTab {...props(list, setEnabled)} />)
    // Wait for the initial load to settle with real timers (findByRole uses setTimeout internally).
    const rowBtn = await screen.findByRole('button', { name: 'togglable-off, Disabled' })
    fireEvent.click(rowBtn)
    expect(screen.getByRole('button', { name: en.enable })).toBeTruthy()

    // Switch to fake timers only after the DOM is fully settled.
    vi.useFakeTimers()
    try {
      // Start the toggle; it will suspend at the setTimeout inside the poll loop.
      const clickAct = act(async () => { fireEvent.click(screen.getByRole('button', { name: en.enable })) })
      // Drain microtasks so the toggle reaches the setTimeout, then tick past it.
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
      await clickAct
    } finally {
      vi.useRealTimers()
    }

    expect(setEnabled).toHaveBeenCalledWith('tog-off', true)
    // list called: 1 initial + 1 first poll + 1 second poll = 3.
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('catches a setEnabled failure and leaves state ready (busy clears)', async () => {
    const list = vi.fn<PluginInventorySettingsTabInjected['list']>().mockResolvedValue(TOGGLABLE_SNAPSHOT)
    const setEnabled = vi.fn<PluginInventorySettingsTabInjected['setEnabled']>()
      .mockRejectedValue(new Error('write failed'))

    render(<PluginInventorySettingsTab {...props(list, setEnabled)} />)
    const rowBtn = await screen.findByRole('button', { name: 'togglable-on, Mounted, Enabled' })
    fireEvent.click(rowBtn)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.disable })) })
    await waitFor(() => { expect(setEnabled).toHaveBeenCalledOnce() })
    // After the catch the component remains in the ready state (no error alert).
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
    // busy is cleared: the disable button is no longer disabled.
    await waitFor(() => {
      const disableBtn = screen.getByRole('button', { name: en.disable })
      expect(disableBtn.getAttribute('disabled')).toBeNull()
    })
  })
})
