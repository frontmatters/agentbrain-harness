// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { ManagedSkillInfo, SkillDetail } from '@agentbrain-harness/api-remotes/client'
import { SkillsPanel } from '../src/client/SkillsPanel.tsx'
import { nl } from '../src/client/locales.ts'

const t = ((key: string): string => (nl as Record<string, string>)[key] ?? key) as ComponentProps<typeof SkillsPanel>['t']

function skill(overrides: Partial<ManagedSkillInfo> = {}): ManagedSkillInfo {
  return { name: 'save-learning', description: 'Save an insight', whenToUse: null, provider: 'agentbrain', enabled: true, ...overrides }
}

function detail(overrides: Partial<SkillDetail> = {}): SkillDetail {
  return { name: 'save-learning', description: 'Save an insight', whenToUse: null, provider: 'agentbrain', content: '# Save\n\nBody text.', tags: [], ...overrides }
}

/** The panel faces with sensible defaults; each test overrides what it exercises. */
function props(overrides: Partial<ComponentProps<typeof SkillsPanel>> = {}): ComponentProps<typeof SkillsPanel> {
  return {
    listSkills: vi.fn(() => Promise.resolve<ManagedSkillInfo[]>([])),
    getSkill: vi.fn((_name: string) => Promise.resolve<SkillDetail | null>(detail())),
    setSkillEnabled: vi.fn((_name: string, _enabled: boolean) => Promise.resolve()),
    t,
    ...overrides,
  }
}

afterEach(cleanup)

describe('SkillsPanel', () => {
  it('shows the loading state before the catalog resolves', () => {
    render(<SkillsPanel {...props({ listSkills: () => new Promise<ManagedSkillInfo[]>(() => {}) })} />)
    expect(screen.getByText(nl.loading)).toBeTruthy()
  })

  it('shows an error with a working retry when the catalog fails once', async () => {
    const listSkills = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce([skill()])
    render(<SkillsPanel {...props({ listSkills })} />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText(nl.retry))
    await screen.findByText('save-learning')
    expect(listSkills).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when no skills exist', async () => {
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([]) })} />)
    await screen.findByText(nl.emptySkills)
  })

  it('renders each skill with its provider chip and whenToUse label, sorted by name', async () => {
    const listSkills = () => Promise.resolve([
      skill({ name: 'zeta', description: 'Z', whenToUse: 'when Z' }),
      skill({ name: 'alpha', description: 'A', whenToUse: null }),
    ])
    render(<SkillsPanel {...props({ listSkills })} />)
    await screen.findByText('alpha')
    const names = screen.getAllByText(/^(alpha|zeta)$/).map(node => node.textContent)
    expect(names).toEqual(['alpha', 'zeta'])
    expect(screen.getByText(nl.whenToUse, { exact: false })).toBeTruthy()
    expect(screen.getByText('when Z', { exact: false })).toBeTruthy()
    expect(screen.getAllByText('agentbrain')).toHaveLength(2)
  })

  it('toggles a skill and refetches the catalog', async () => {
    const setSkillEnabled = vi.fn(() => Promise.resolve())
    const listSkills = vi.fn(() => Promise.resolve([skill({ enabled: true })]))
    render(<SkillsPanel {...props({ listSkills, setSkillEnabled })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.disable))
    await waitFor(() => { expect(setSkillEnabled).toHaveBeenCalledWith('save-learning', false) })
    await waitFor(() => { expect(listSkills).toHaveBeenCalledTimes(2) })
  })

  it('opens the detail modal, renders the SKILL.md body with tags, and closes', async () => {
    const getSkill = vi.fn(() => Promise.resolve(detail({ whenToUse: 'when useful', tags: ['brain', 'learning'] })))
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill()]), getSkill })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.view))
    await screen.findByText('Body text.')
    expect(getSkill).toHaveBeenCalledWith('save-learning')
    expect(screen.getByText('brain')).toBeTruthy()
    expect(screen.getByText('learning')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(nl.close))
    await waitFor(() => { expect(screen.queryByText('Body text.')).toBeNull() })
  })

  it('shows a loading then error body when the detail cannot load', async () => {
    let resolveGet: (value: SkillDetail | null) => void = () => {}
    const getSkill = vi.fn(() => new Promise<SkillDetail | null>((resolve) => { resolveGet = resolve }))
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill()]), getSkill })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.view))
    await screen.findByText(nl.viewLoading)
    resolveGet(null)
    await screen.findByText(nl.viewError)
  })

  it('surfaces the error body when the detail request rejects', async () => {
    const getSkill = vi.fn(() => Promise.reject(new Error('boom')))
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill()]), getSkill })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.view))
    await screen.findByText(nl.viewError)
  })

  it('labels a disabled skill with the enable action', async () => {
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill({ enabled: false })]) })} />)
    await screen.findByText('save-learning')
    expect(screen.getByText(nl.enable)).toBeTruthy()
  })

  it('ignores a catalog result that resolves after unmount', async () => {
    let resolveList: (value: ManagedSkillInfo[]) => void = () => {}
    const listSkills = () => new Promise<ManagedSkillInfo[]>((resolve) => { resolveList = resolve })
    const { unmount } = render(<SkillsPanel {...props({ listSkills })} />)
    unmount()
    resolveList([skill()])
    await Promise.resolve()
  })

  it('ignores a catalog rejection that settles after unmount', async () => {
    let rejectList: (reason: Error) => void = () => {}
    const listSkills = () => new Promise<ManagedSkillInfo[]>((_resolve, reject) => { rejectList = reject })
    const { unmount } = render(<SkillsPanel {...props({ listSkills })} />)
    unmount()
    rejectList(new Error('late'))
    await Promise.resolve()
  })

  it('discards a detail response that arrives after the modal closed', async () => {
    let resolveGet: (value: SkillDetail | null) => void = () => {}
    const getSkill = vi.fn(() => new Promise<SkillDetail | null>((resolve) => { resolveGet = resolve }))
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill()]), getSkill })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.view))
    await screen.findByText(nl.viewLoading)
    fireEvent.click(screen.getByLabelText(nl.close))
    await waitFor(() => { expect(screen.queryByText(nl.viewLoading)).toBeNull() })
    resolveGet(detail())
    await Promise.resolve()
    expect(screen.queryByText('Body text.')).toBeNull()
  })

  it('discards a detail rejection that settles after the modal closed', async () => {
    let rejectGet: (reason: Error) => void = () => {}
    const getSkill = vi.fn(() => new Promise<SkillDetail | null>((_resolve, reject) => { rejectGet = reject }))
    render(<SkillsPanel {...props({ listSkills: () => Promise.resolve([skill()]), getSkill })} />)
    await screen.findByText('save-learning')
    fireEvent.click(screen.getByText(nl.view))
    await screen.findByText(nl.viewLoading)
    fireEvent.click(screen.getByLabelText(nl.close))
    await waitFor(() => { expect(screen.queryByText(nl.viewLoading)).toBeNull() })
    rejectGet(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByText(nl.viewError)).toBeNull()
  })
})
