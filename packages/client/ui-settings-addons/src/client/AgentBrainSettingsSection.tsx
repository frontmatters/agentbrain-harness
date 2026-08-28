import { useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@agentbrain-harness/client-ui-slots'
import { AddonsPanel } from './AddonsPanel.tsx'
import { SkillsPanel } from './SkillsPanel.tsx'
import type { AgentBrainAddonsInjected, AgentBrainSkillsInjected } from './faces.ts'
import css from './AgentBrainSettingsSection.module.css'

export type { AgentBrainAddonsInjected } from './faces.ts'

/** Everything the section injects: both panels' host faces. */
export type AgentBrainSectionInjected = AgentBrainAddonsInjected & AgentBrainSkillsInjected
export type AgentBrainSettingsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.agentBrainAddons'> & InjectFace<AgentBrainSectionInjected>

/** The two panels the AgentBrain section switches between. */
const TABS = [
  { id: 'addons', label: 'addonsTab' },
  { id: 'skills', label: 'skillsTab' },
] as const
type TabId = (typeof TABS)[number]['id']

/** Render the AgentBrain settings section: addon management and skill policy behind two tabs. */
export function AgentBrainSettingsSection(props: AgentBrainSettingsSectionProps): ReactNode {
  const { list, enable, disable, check, test, listSkills, getSkill, setSkillEnabled, t } = props
  const [active, setActive] = useState<TabId>('addons')
  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <div className={css.tabs} role="tablist" aria-label={t('title')}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={css.tab}
            aria-selected={active === tab.id}
            data-active={active === tab.id ? 'true' : undefined}
            onClick={() => { setActive(tab.id) }}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>
      {active === 'addons'
        ? <AddonsPanel list={list} enable={enable} disable={disable} check={check} test={test} t={t} />
        : <SkillsPanel listSkills={listSkills} getSkill={getSkill} setSkillEnabled={setSkillEnabled} t={t} />}
    </div>
  )
}
