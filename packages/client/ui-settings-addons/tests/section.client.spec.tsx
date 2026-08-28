// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { AddonInfo, ManagedSkillInfo } from '@agentbrain-harness/api-remotes/client'
import { AgentBrainSettingsSection } from '../src/client/AgentBrainSettingsSection.tsx'
import { nl } from '../src/client/locales.ts'

// Stub mirrors the real lookup chain: package dictionary first, then the key.
// Parameter types are explicit so the function is never typed as `any`.
function t(key: string): string {
  return (nl as Record<string, string>)[key] ?? key
}

// The section reads only the injected faces and `t`; the runtime props
// (close, useSessions, useWorkspaces) are unused here, so the stub supplies the
// faces and is widened to the full props type for the render call.
type SectionProps = ComponentProps<typeof AgentBrainSettingsSection>

/** Stub props covering all injected faces; list/listSkills resolve to [] so panels settle quickly. */
function sectionProps(): SectionProps {
  const faces = {
    list: vi.fn(() => Promise.resolve<AddonInfo[]>([])),
    enable: vi.fn((_id: string) => Promise.resolve()),
    disable: vi.fn((_id: string) => Promise.resolve()),
    check: vi.fn((_id: string) => Promise.resolve({ ok: true, detail: '' })),
    test: vi.fn((_id: string) => Promise.resolve({ ok: true, detail: '' })),
    listSkills: vi.fn(() => Promise.resolve<ManagedSkillInfo[]>([])),
    getSkill: vi.fn((_name: string) => Promise.resolve(null)),
    setSkillEnabled: vi.fn((_name: string, _enabled: boolean) => Promise.resolve()),
    t,
  }
  return faces as unknown as SectionProps
}

afterEach(cleanup)

describe('AgentBrainSettingsSection', () => {
  it('renders the heading and intro paragraph', () => {
    render(<AgentBrainSettingsSection {...sectionProps()} />)
    expect(screen.getByRole('heading', { level: 2, name: nl.title })).toBeTruthy()
    expect(screen.getByText(nl.intro)).toBeTruthy()
  })

  it('renders a tablist with both tabs', () => {
    render(<AgentBrainSettingsSection {...sectionProps()} />)
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getByRole('tab', { name: nl.addonsTab })).toBeTruthy()
    expect(screen.getByRole('tab', { name: nl.skillsTab })).toBeTruthy()
  })

  it('defaults to the addons tab (AddonsPanel visible, SkillsPanel not)', async () => {
    render(<AgentBrainSettingsSection {...sectionProps()} />)
    expect(screen.getByRole('tab', { name: nl.addonsTab }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: nl.skillsTab }).getAttribute('aria-selected')).toBe('false')
    await screen.findByText(nl.empty)
    expect(screen.queryByText(nl.emptySkills)).toBeNull()
  })

  it('clicking the skills tab switches to SkillsPanel', async () => {
    render(<AgentBrainSettingsSection {...sectionProps()} />)
    await screen.findByText(nl.empty)
    fireEvent.click(screen.getByRole('tab', { name: nl.skillsTab }))
    expect(screen.getByRole('tab', { name: nl.skillsTab }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: nl.addonsTab }).getAttribute('aria-selected')).toBe('false')
    await screen.findByText(nl.emptySkills)
    expect(screen.queryByText(nl.empty)).toBeNull()
  })
})
