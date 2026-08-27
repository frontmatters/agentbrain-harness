// @vitest-environment jsdom
// GoalBar behavior: the docked strip above the composer — phase labels,
// inline edit form, and resume/clear icon actions — driven purely through
// props, no wire. Loading, absent, and complete goals render nothing.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GoalSnapshot } from '@agentbrain-harness/goal/client'
import { makeTranslate } from '@agentbrain-harness/client-test-runtime'
import { nl as commonNl } from '@agentbrain-harness/client-locale/src/locales/nl.ts'
import { GoalBar } from '../src/client/GoalBar.tsx'
import type { GoalActionResult, GoalBarActions } from '../src/client/slots.ts'
import { nl } from '../src/client/locales.ts'

// The framework-injected t seat, stubbed over the nl dictionaries (the default locale).
const t: Parameters<typeof GoalBar>[0]['t'] = makeTranslate(nl, commonNl)

afterEach(cleanup)

function makeGoal(over: Partial<GoalSnapshot> = {}): GoalSnapshot {
  return {
    id: 'g1' as GoalSnapshot['id'],
    revision: 1,
    objective: 'Ship the redesign',
    phase: 'active',
    maxGoalRounds: 4,
    ...over,
  }
}

function makeActions() {
  return {
    onEdit: vi.fn<GoalBarActions['onEdit']>(() => Promise.resolve({ ok: true, value: undefined })),
    onPause: vi.fn<GoalBarActions['onPause']>(() => Promise.resolve({ ok: true, value: undefined })),
    onResume: vi.fn<GoalBarActions['onResume']>(() => Promise.resolve({ ok: true, value: undefined })),
    onClear: vi.fn<GoalBarActions['onClear']>(() => Promise.resolve({ ok: true, value: undefined })),
  } satisfies GoalBarActions
}

describe('GoalBar', () => {
  it('renders nothing while loading, absent, or when the goal is complete', () => {
    const actions = makeActions()
    const loading = render(<GoalBar goal={undefined} {...actions} t={t} />)
    expect(loading.container.firstChild).toBeNull()
    cleanup()

    const absent = render(<GoalBar goal={null} {...actions} t={t} />)
    expect(absent.container.firstChild).toBeNull()
    cleanup()

    const complete = render(<GoalBar goal={makeGoal({ phase: 'complete' })} {...actions} t={t} />)
    expect(complete.container.firstChild).toBeNull()
  })

  it('active goal: goal glyph, "Actief goal", truncated objective, edit and clear actions', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    expect(screen.getByText('Actief goal')).toBeTruthy()
    expect(screen.getByText('Ship the redesign')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Goal wissen' }))
    expect(actions.onClear).toHaveBeenCalledTimes(1)
  })

  it('single-flights rapid clear clicks and hides the committed goal before its projection catches up', async () => {
    const actions = makeActions()
    let resolveClear!: (result: GoalActionResult) => void
    actions.onClear.mockImplementation(() => new Promise((resolve) => { resolveClear = resolve }))
    const { container, rerender } = render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    const clear = screen.getByRole<HTMLButtonElement>('button', { name: 'Goal wissen' })

    act(() => {
      clear.click()
      clear.click()
    })
    expect(actions.onClear).toHaveBeenCalledTimes(1)
    expect(clear.disabled).toBe(true)

    await act(async () => { resolveClear({ ok: true, value: undefined }) })
    expect(container.firstChild).toBeNull()

    rerender(<GoalBar goal={makeGoal({ id: 'g2' as GoalSnapshot['id'], objective: 'Next goal' })} {...actions} t={t} />)
    expect(screen.getByText('Next goal')).toBeTruthy()
  })

  it('edit swaps the strip for a prefilled form; Enter saves, empty stays disabled', async () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    const box = screen.getByRole('textbox', { name: 'Goal-omschrijving' })
    expect(box).toHaveProperty('value', 'Ship the redesign')

    fireEvent.change(box, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Goal opslaan' })).toHaveProperty('disabled', true)

    fireEvent.change(box, { target: { value: 'Ship v2' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(actions.onEdit).toHaveBeenCalledWith('Ship v2')
    await waitFor(() => { expect(screen.getByText('Actief goal')).toBeTruthy() })
  })

  it('Esc cancels the edit without calling onEdit', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Goal-omschrijving' }), { key: 'Escape' })
    expect(actions.onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Actief goal')).toBeTruthy()
  })

  it('the cancel button exits the form and drops the draft (re-edit starts from the objective)', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal-omschrijving' }), { target: { value: 'abandoned draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bewerking annuleren' }))
    expect(actions.onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Actief goal')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    expect(screen.getByRole('textbox', { name: 'Goal-omschrijving' })).toHaveProperty('value', 'Ship the redesign')
  })

  it('Enter with a blank draft neither saves nor closes the form', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    const box = screen.getByRole('textbox', { name: 'Goal-omschrijving' })
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(actions.onEdit).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Goal-omschrijving' })).toBeTruthy()
  })

  it('active goal: the pause action pauses', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal pauzeren' }))
    expect(actions.onPause).toHaveBeenCalledTimes(1)
  })

  it('paused goal: "Gepauzeerd goal" with a resume action before edit', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal({ phase: 'paused' })} {...actions} t={t} />)
    expect(screen.getByText('Gepauzeerd goal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Goal hervatten' }))
    expect(actions.onResume).toHaveBeenCalledTimes(1)
  })

  it('a new goal identity drops the edit form (no stale draft over the new goal)', () => {
    const actions = makeActions()
    const { rerender } = render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal-omschrijving' }), { target: { value: 'stale draft' } })

    rerender(<GoalBar goal={makeGoal({ id: 'g2' as GoalSnapshot['id'], objective: 'New goal' })} {...actions} t={t} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Actief goal')).toBeTruthy()
    expect(screen.getByText('New goal')).toBeTruthy()

    rerender(<GoalBar goal={null} {...actions} t={t} />)
    expect(screen.queryByText('Actief goal')).toBeNull()
  })

  it('blocked goal: "Geblokkeerd goal" with the block reason as the strip tooltip', () => {
    const actions = makeActions()
    const goal = makeGoal({ phase: 'blocked', blockedReason: { code: 'stalled', message: 'No progress in 3 rounds' } })
    render(<GoalBar goal={goal} {...actions} t={t} />)
    expect(screen.getByText('Geblokkeerd goal')).toBeTruthy()
    expect(screen.getByText('Geblokkeerd goal').closest('[title]')?.getAttribute('title')).toBe('No progress in 3 rounds')
  })

  it('blocked goal without a reason carries no tooltip', () => {
    const actions = makeActions()
    render(<GoalBar goal={makeGoal({ phase: 'blocked' })} {...actions} t={t} />)
    expect(screen.getByText('Geblokkeerd goal')).toBeTruthy()
    expect(screen.getByText('Geblokkeerd goal').closest('[title]')).toBeNull()
  })

  it('keeps the edit draft open and reports a failed save', async () => {
    const actions = makeActions()
    actions.onEdit.mockResolvedValue({ ok: false, error: { code: 'agent-busy', message: 'stale revision', details: {} } })
    render(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal bewerken' }))
    const box = screen.getByRole('textbox', { name: 'Goal-omschrijving' })
    fireEvent.change(box, { target: { value: 'retry this draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Goal opslaan' }))

    expect((await screen.findByRole('alert')).textContent).toBe('stale revision (agent-busy)')
    expect(screen.getByRole('textbox', { name: 'Goal-omschrijving' })).toHaveProperty('value', 'retry this draft')
  })

  it('reports resume and clear failures without hiding the goal', async () => {
    const actions = makeActions()
    actions.onResume.mockResolvedValue({ ok: false, error: { code: 'internal', message: 'resume failed', details: {} } })
    const { rerender } = render(<GoalBar goal={makeGoal({ phase: 'paused' })} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal hervatten' }))
    expect((await screen.findByRole('alert')).textContent).toBe('resume failed (internal)')

    actions.onClear.mockResolvedValue({ ok: false, error: { code: 'agent-busy', message: 'clear failed', details: {} } })
    rerender(<GoalBar goal={makeGoal()} {...actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Goal wissen' }))
    expect((await screen.findByRole('alert')).textContent).toBe('clear failed (agent-busy)')
    expect(screen.getByText('Ship the redesign')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Goal wissen' }))
    await waitFor(() => { expect(actions.onClear).toHaveBeenCalledTimes(2) })
  })
})
