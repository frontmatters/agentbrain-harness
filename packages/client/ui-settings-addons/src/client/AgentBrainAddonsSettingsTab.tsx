import { useEffect, useState, type ReactNode } from 'react'
import type { AddonInfo, ManagedSkillInfo } from '@agentbrain-harness/api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@agentbrain-harness/client-ui-slots'
import css from './AgentBrainAddonsSettingsTab.module.css'

/** Remote operations supplied by the host namespace. */
export interface AgentBrainAddonsInjected {
  readonly list: () => Promise<AddonInfo[]>
  readonly enable: (id: string) => Promise<void>
  readonly disable: (id: string) => Promise<void>
  readonly check: (id: string) => Promise<{ ok: boolean; detail: string }>
  readonly test: (id: string) => Promise<{ ok: boolean; detail: string }>
  readonly listSkills: () => Promise<ManagedSkillInfo[]>
  readonly setSkillEnabled: (name: string, enabled: boolean) => Promise<void>
}
export type AgentBrainAddonsSettingsTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.agentBrainAddons'> & InjectFace<AgentBrainAddonsInjected>

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; addons: AddonInfo[] }

/** Return the user-facing layer label for an addon source. */
function sourceLabel(source: AddonInfo['source'], t: AgentBrainAddonsSettingsTabProps['t']): string {
  return t(source === 'bundled' ? 'system' : 'local')
}

/** Render one addon health result when a check has completed. */
function checkStatus(
  result: { ok: boolean; detail: string } | undefined,
  t: AgentBrainAddonsSettingsTabProps['t'],
): ReactNode {
  if (result === undefined) return null
  return <span role="status" data-check={result.ok ? 'ok' : 'failed'} title={result.detail}>{result.ok ? t('healthy') : t('unhealthy')}</span>
}

/** Render the host-managed addon list and its enable/disable actions. */
export function AgentBrainAddonsSettingsTab({
  list, enable, disable, check, test, listSkills, setSkillEnabled, t,
}: AgentBrainAddonsSettingsTabProps): ReactNode {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [checks, setChecks] = useState<ReadonlyMap<string, { ok: boolean; detail: string }>>(() => new Map())
  const [skills, setSkills] = useState<ManagedSkillInfo[]>([])
  const [skillError, setSkillError] = useState(false)
  useEffect(() => {
    let current = true
    void list().then((addons) => { if (current) setState({ status: 'ready', addons }) }, () => { if (current) setState({ status: 'error' }) })
    void listSkills().then((value) => { if (current) setSkills(value) }, () => { if (current) setSkillError(true) })
    return () => { current = false }
  }, [list, refresh])
  const retry = (): void => { setState({ status: 'loading' }); setRefresh(value => value + 1) }
  const runAddonCheck = async (addon: AddonInfo, action: (id: string) => Promise<{ ok: boolean; detail: string }>): Promise<void> => {
    setBusy(addon.id)
    try {
      const result = await action(addon.id)
      setChecks(previous => new Map(previous).set(addon.id, result))
    } catch {
      setChecks(previous => new Map(previous).set(addon.id, { ok: false, detail: t('failed') }))
    } finally { setBusy(null) }
  }
  const runCheck = (addon: AddonInfo): Promise<void> => runAddonCheck(addon, check)
  const runSuiteTest = (addon: AddonInfo): Promise<void> => runAddonCheck(addon, test)
  const toggleSkill = async (skill: ManagedSkillInfo): Promise<void> => {
    setBusy(skill.name)
    try {
      await setSkillEnabled(skill.name, !skill.enabled)
      setSkills(await listSkills())
    } finally { setBusy(null) }
  }
  const toggle = async (addon: AddonInfo): Promise<void> => {
    if (addon.state === 'enabled' && !window.confirm(t('confirmDisable'))) return
    setBusy(addon.id)
    try {
      await (addon.state === 'enabled' ? disable(addon.id) : enable(addon.id))
      retry()
    } catch {
      setState(current => current.status === 'ready' ? current : { status: 'error' })
    } finally { setBusy(null) }
  }
  if (state.status === 'loading') return <p className={css.status}>{t('loading')}</p>
  if (state.status === 'error') return <div className={css.failure}><p role="alert">{t('error')}</p><button type="button" onClick={retry}>{t('retry')}</button></div>
  const checkResult = (addon: AddonInfo): { ok: boolean; detail: string } | undefined => checks.get(addon.id)
  return <div className={css.section} aria-busy={busy !== null}>
    {state.addons.length === 0 ? <p className={css.status}>{t('empty')}</p> : <ul className={css.list}>
      {state.addons.map(addon => <li className={css.item} key={addon.id}>
        <div className={css.identity}><div className={css.title}><strong>{addon.name}</strong><span className={css.layer} data-source={addon.source}>{sourceLabel(addon.source, t)}</span></div><p><code>{addon.id}</code>{addon.version ? ` · ${addon.version}` : ''}</p><p>{addon.os ?? 'any'} · {addon.privacy ?? 'privacy unspecified'}</p>{addon.skills.length > 0 ? <p>{addon.skills.map(skill => <span key={skill.name} data-skill={skill.name}>skill: {skill.name} </span>)}</p> : null}{Object.entries(addon.support).length > 0 ? <p>{Object.entries(addon.support).map(([client, level]) => <span key={client} data-support={level}>{client}: {level} </span>)}</p> : null}</div>
        <div className={css.actions}>
          <button type="button" disabled={busy !== null} onClick={() => { void runCheck(addon) }}>{busy === addon.id ? t('checking') : t('check')}</button>
          <button type="button" disabled={busy !== null} onClick={() => { void runSuiteTest(addon) }}>{t('suiteTest')}</button>
          <button type="button" disabled={busy !== null} onClick={() => { void toggle(addon) }}>{t(addon.state === 'enabled' ? 'disable' : 'enable')}</button>
          {checkStatus(checkResult(addon), t)}
        </div>
      </li>)}
    </ul>}
    <h3>{t('skills')}</h3>
    {skillError ? <p className={css.status}>{t('errorSkills')}</p> : skills.length === 0 ? <p className={css.status}>{t('emptySkills')}</p> : <ul className={css.list}>{skills.map(skill => <li className={css.item} key={skill.name}><div><strong>{skill.name}</strong><p>{skill.description} · {skill.provider}</p></div><button type="button" disabled={busy !== null} onClick={() => { void toggleSkill(skill) }}>{t(skill.enabled ? 'disable' : 'enable')}</button></li>)}</ul>}
  </div>
}
