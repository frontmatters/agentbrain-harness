import type { ReactNode } from 'react'

/** Localized labels the expand/collapse toggle renders. */
export interface ExpandToggleCopy {
  /** Label and aria-label shown while expanded. */
  collapse: string
  collapseAria: string
  /** Label and aria-label shown while collapsed, given the hidden-row count. */
  expand: (hidden: number) => string
  expandAria: (hidden: number) => string
}

/** Props for {@link ExpandToggle}. */
export interface ExpandToggleProps {
  /** Number of hidden rows; the toggle renders nothing at zero. */
  hidden: number
  /** Whether the block is currently expanded. */
  expanded: boolean
  /** Expand/collapse handler. */
  onToggle: () => void
  /** The caller's expand-button class (its own CSS-module `expand`). */
  className: string | undefined
  /** The localized labels. */
  copy: ExpandToggleCopy
}

/**
 * The shared "show N more / collapse" toggle used by the block renderers
 * (diff, read, search, terminal). Renders nothing when nothing is hidden.
 * @param props - {@link ExpandToggleProps}.
 * @returns the toggle button, or null when `hidden` is zero.
 */
export function ExpandToggle({ hidden, expanded, onToggle, className, copy }: ExpandToggleProps): ReactNode {
  if (hidden <= 0) return null
  return (
    <button
      type="button"
      className={className}
      aria-expanded={expanded}
      aria-label={expanded ? copy.collapseAria : copy.expandAria(hidden)}
      onClick={onToggle}
    >
      {expanded ? copy.collapse : copy.expand(hidden)}
    </button>
  )
}
