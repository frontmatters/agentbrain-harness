/**
 * A controlled model chooser: one labelled select over a list of model ids,
 * with loading, empty, and error states. It holds no data source of its own, so
 * every surface that picks a model (onboarding local and cloud paths, the
 * Models page, a future model switcher) reuses it by passing the ids it already
 * resolved, whether from {@link probeLocalRuntime}, a route catalog, or
 * discovery. Selection flows back through `onChange`; persistence is the
 * caller's, for example {@link writeDefaultModel}.
 *
 * @module @agentbrain-harness/client-ui-settings-models/ModelPicker
 */

import { useId } from 'react'
import type { ReactNode } from 'react'
import styles from './ModelPicker.module.css'

/** Props for {@link ModelPicker}. */
export interface ModelPickerProps {
  /** The model ids to offer, in display order. */
  models: readonly string[]
  /** The selected model id, or undefined when none is chosen yet. */
  value: string | undefined
  /** Called with the model id the user selects. */
  onChange: (model: string) => void
  /** Visible field label. */
  label: string
  /** Disables selection (for example while a save is in flight). */
  disabled?: boolean
  /** Shows a loading affordance while the model list is being resolved. */
  busy?: boolean
  /** An error to show under the field; supersedes the empty hint. */
  error?: string
  /** Text shown when no models are available and none are loading. */
  emptyHint?: string
  /** Placeholder option text shown when no value is selected. */
  placeholder?: string
}

/**
 * Render the model chooser.
 * @param props - the controlled model-picker props.
 * @returns the labelled select with its state affordances.
 */
export function ModelPicker(props: ModelPickerProps): ReactNode {
  const { models, value, onChange, label, disabled, busy, error, emptyHint, placeholder } = props
  const selectId = useId()
  const hintId = `${selectId}-hint`
  const empty = models.length === 0
  const hint = error ?? (empty && !busy ? emptyHint : undefined)

  return (
    <div className={styles['field']}>
      <label className={styles['label']} htmlFor={selectId}>{label}</label>
      <div className={styles['control']}>
        <select
          id={selectId}
          className={styles['selectInput']}
          value={value ?? ''}
          disabled={disabled === true || busy === true || empty}
          aria-label={label}
          aria-describedby={hint === undefined ? undefined : hintId}
          onChange={(event) => { onChange(event.target.value) }}
        >
          {value === undefined
            ? <option value="" disabled>{placeholder ?? label}</option>
            : null}
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
        {busy === true ? <span className={styles['busy']} aria-hidden="true" /> : null}
      </div>
      {hint === undefined
        ? null
        : <p id={hintId} className={error === undefined ? styles['hint'] : styles['error']}>{hint}</p>}
    </div>
  )
}
