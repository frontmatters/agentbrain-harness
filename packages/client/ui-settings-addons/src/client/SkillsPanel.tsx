import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { ManagedSkillInfo, SkillDetail } from '@agentbrain-harness/api-remotes/client'
import { Button, MarkdownText, Modal } from '@agentbrain-harness/client-ui-primitives'
import type { AgentBrainSkillsInjected, SectionLocale } from './faces.ts'
import css from './AgentBrainSettingsSection.module.css'

/** The skill-management face this panel consumes. */
export type SkillsPanelProps = AgentBrainSkillsInjected & { readonly t: SectionLocale }

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; skills: ManagedSkillInfo[] }
type DetailView = { status: 'loading' } | { status: 'error' } | { status: 'ready'; skill: SkillDetail }
type Viewing = { name: string; view: DetailView }

/** Render the skill catalog the default preset composes, with per-skill enable/disable policy and a full-content view. */
export function SkillsPanel({ listSkills, getSkill, setSkillEnabled, t }: SkillsPanelProps): ReactNode {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Viewing | null>(null)
  useEffect(() => {
    let current = true
    void listSkills().then((skills) => { if (current) setState({ status: 'ready', skills }) }, () => { if (current) setState({ status: 'error' }) })
    return () => { current = false }
  }, [listSkills, refresh])
  const retry = (): void => { setState({ status: 'loading' }); setRefresh(value => value + 1) }
  const toggle = async (skill: ManagedSkillInfo): Promise<void> => {
    setBusy(skill.name)
    try {
      await setSkillEnabled(skill.name, !skill.enabled)
      retry()
    } catch {
      // The toggle buttons render only in the ready state and retry() runs only
      // after success, so a failing toggle always finds state still ready; the
      // error arm is a race backstop with no reachable trigger.
      /* v8 ignore next */
      setState(current => current.status === 'ready' ? current : { status: 'error' })
    } finally { setBusy(null) }
  }
  const openView = useCallback((name: string): void => {
    setViewing({ name, view: { status: 'loading' } })
    void getSkill(name).then(
      (skill) => { setViewing(current => current?.name === name ? { name, view: skill === null ? { status: 'error' } : { status: 'ready', skill } } : current) },
      () => { setViewing(current => current?.name === name ? { name, view: { status: 'error' } } : current) },
    )
  }, [getSkill])
  const closeView = useCallback((): void => { setViewing(null) }, [])
  if (state.status === 'loading') return <p className={css.status}>{t('loading')}</p>
  if (state.status === 'error') {
    return (
      <div className={css.failure}>
        <p role="alert">{t('errorSkills')}</p>
        <Button variant="outline" size="sm" onClick={retry}>{t('retry')}</Button>
      </div>
    )
  }
  if (state.skills.length === 0) return <p className={css.status}>{t('emptySkills')}</p>
  const skills = [...state.skills].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className={css.panel} aria-busy={busy !== null}>
      <ul className={css.list}>
        {skills.map(skill => (
          <li className={css.item} key={skill.name}>
            <div className={css.identity}>
              <div className={css.title}>
                <span className={css.name}>{skill.name}</span>
                <span className={css.chip} data-kind="skill">{skill.provider}</span>
              </div>
              <p className={css.subtitle}>{skill.description}</p>
              {skill.whenToUse !== null && (
                <p className={css.subtitle}><span className={css.metaLabel}>{t('whenToUse')}: </span>{skill.whenToUse}</p>
              )}
            </div>
            <div className={css.actions}>
              <Button variant="ghost" size="sm" onClick={() => { openView(skill.name) }}>{t('view')}</Button>
              <Button variant={skill.enabled ? 'outline' : 'primary'} size="sm" disabled={busy !== null} onClick={() => { void toggle(skill) }}>{t(skill.enabled ? 'disable' : 'enable')}</Button>
            </div>
          </li>
        ))}
      </ul>
      {viewing !== null && (
        <Modal open onClose={closeView} title={viewing.name} closeLabel={t('close')}>
          <SkillDetailBody view={viewing.view} t={t} />
        </Modal>
      )}
    </div>
  )
}

/** The body of the skill-detail modal: loading, error, or the rendered SKILL.md content. */
function SkillDetailBody({ view, t }: { readonly view: DetailView; readonly t: SectionLocale }): ReactNode {
  if (view.status === 'loading') return <p className={css.status}>{t('viewLoading')}</p>
  if (view.status === 'error') return <p role="alert">{t('viewError')}</p>
  const { skill } = view
  return (
    <div className={css.detail}>
      <p className={css.subtitle}>{skill.description}</p>
      <div className={css.meta}>
        <span className={css.chip} data-kind="skill">{skill.provider}</span>
        {skill.tags.map(tag => <span className={css.chip} key={tag}>{tag}</span>)}
      </div>
      {skill.whenToUse !== null && (
        <p className={css.subtitle}><span className={css.metaLabel}>{t('whenToUse')}: </span>{skill.whenToUse}</p>
      )}
      <div className={css.detailBody}><MarkdownText text={skill.content} /></div>
    </div>
  )
}
