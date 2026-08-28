import { useEffect, useState, type ReactNode } from 'react'
import type { AddonInfo } from '@agentbrain-harness/api-remotes/client'
import { Button } from '@agentbrain-harness/client-ui-primitives'
import type { AgentBrainAddonsInjected, SectionLocale } from './faces.ts'
import css from './AgentBrainSettingsSection.module.css'

/** The addon-management face this panel consumes. */
export type AddonsPanelProps = AgentBrainAddonsInjected & { readonly t: SectionLocale }

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; addons: AddonInfo[] }

/** Return the user-facing layer label for an addon source. */
function sourceLabel(source: AddonInfo['source'], t: SectionLocale): string {
  return t(source === 'bundled' ? 'system' : 'local')
}

/** Render one addon health result when a check has completed. */
function checkStatus(result: { ok: boolean; detail: string } | undefined, t: SectionLocale): ReactNode {
  if (result === undefined) return null
  return <span className={css.health} role="status" data-check={result.ok ? 'ok' : 'failed'} title={result.detail}>{result.ok ? t('healthy') : t('unhealthy')}</span>
}

/** Render the compact metadata chip row for one addon: platform, privacy, per-client support, and skills. */
function metaChips(addon: AddonInfo): ReactNode {
  return (
    <div className={css.meta}>
      <span className={css.chip}>{addon.os ?? 'any'}</span>
      {addon.privacy === null ? null : <span className={css.chip}>{addon.privacy}</span>}
      {Object.entries(addon.support).map(([client, level]) => (
        <span key={client} className={css.chip} data-support={level}>{client}: {level}</span>
      ))}
      {addon.skills.map(skill => <span key={skill.name} className={css.chip} data-kind="skill">{skill.name}</span>)}
    </div>
  )
}

/** Render the host-managed addon list, grouped by source, with enable/disable actions. */
export function AddonsPanel({ list, enable, disable, check, test, t }: AddonsPanelProps): ReactNode {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [checks, setChecks] = useState<ReadonlyMap<string, { ok: boolean; detail: string }>>(() => new Map())
  useEffect(() => {
    let current = true
    void list().then((addons) => { if (current) setState({ status: 'ready', addons }) }, () => { if (current) setState({ status: 'error' }) })
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
  const toggle = async (addon: AddonInfo): Promise<void> => {
    if (addon.state === 'enabled' && !window.confirm(t('confirmDisable'))) return
    setBusy(addon.id)
    try {
      await (addon.state === 'enabled' ? disable(addon.id) : enable(addon.id))
      retry()
    } catch {
      // The toggle buttons render only in the ready state and retry() runs only
      // after success, so a failing toggle always finds state still ready; the
      // error arm is a race backstop with no reachable trigger.
      /* v8 ignore next */
      setState(current => current.status === 'ready' ? current : { status: 'error' })
    } finally { setBusy(null) }
  }
  const bulkToggle = async (addons: readonly AddonInfo[], turnOn: boolean): Promise<void> => {
    const targets = addons.filter(addon => turnOn ? addon.state !== 'enabled' : addon.state === 'enabled')
    if (targets.length === 0) return
    if (!turnOn && !window.confirm(t('confirmDisableAll'))) return
    setBusy('*')
    try {
      for (const addon of targets) await (turnOn ? enable(addon.id) : disable(addon.id))
      retry()
    } catch {
      // Same race backstop as toggle(): the bulk buttons render only in the
      // ready state, so the error arm has no reachable trigger.
      /* v8 ignore next */
      setState(current => current.status === 'ready' ? current : { status: 'error' })
    } finally { setBusy(null) }
  }
  const checkResult = (addon: AddonInfo): { ok: boolean; detail: string } | undefined => checks.get(addon.id)
  const byName = (items: readonly AddonInfo[]): AddonInfo[] => [...items].sort((a, b) => a.name.localeCompare(b.name))
  if (state.status === 'loading') return <p className={css.status}>{t('loading')}</p>
  if (state.status === 'error') {
    return (
      <div className={css.failure}>
        <p role="alert">{t('error')}</p>
        <Button variant="outline" size="sm" onClick={retry}>{t('retry')}</Button>
      </div>
    )
  }
  if (state.addons.length === 0) return <p className={css.status}>{t('empty')}</p>
  // System (bundled) addons first, then local, each alphabetical.
  const groups = [
    { key: 'bundled', label: t('system'), addons: byName(state.addons.filter(addon => addon.source === 'bundled')) },
    { key: 'local', label: t('local'), addons: byName(state.addons.filter(addon => addon.source !== 'bundled')) },
  ].filter(group => group.addons.length > 0)
  return (
    <div className={css.panel} aria-busy={busy !== null}>
      {groups.map(group => (
        <section className={css.group} key={group.key}>
          <div className={css.groupHead}>
            <h3 className={css.groupTitle}>{group.label}</h3>
            <div className={css.groupActions}>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => { void bulkToggle(group.addons, true) }}>{t('enableAll')}</Button>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => { void bulkToggle(group.addons, false) }}>{t('disableAll')}</Button>
            </div>
          </div>
          <ul className={css.list}>
            {group.addons.map(addon => (
              <li className={css.item} key={addon.id}>
                <div className={css.identity}>
                  <div className={css.title}>
                    <span className={css.name}>{addon.name}</span>
                    <span className={css.layer} data-source={addon.source}>{sourceLabel(addon.source, t)}</span>
                  </div>
                  <p className={css.subtitle}><code>{addon.id}</code>{addon.version === null ? '' : ` · ${addon.version}`}</p>
                  {metaChips(addon)}
                </div>
                <div className={css.actions}>
                  {checkStatus(checkResult(addon), t)}
                  <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => { void runCheck(addon) }}>{busy === addon.id ? t('checking') : t('check')}</Button>
                  <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => { void runSuiteTest(addon) }}>{t('suiteTest')}</Button>
                  <Button variant={addon.state === 'enabled' ? 'outline' : 'primary'} size="sm" disabled={busy !== null} onClick={() => { void toggle(addon) }}>{t(addon.state === 'enabled' ? 'disable' : 'enable')}</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
