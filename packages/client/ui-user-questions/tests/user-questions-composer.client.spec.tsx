// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ConversationSnapshot, SessionId, SessionListState, WorkspaceListState,
} from '@agentbrain-harness/client-runtime/client'
import { PendingWait } from '@agentbrain-harness/client-runtime/client'
import type { RpcReceipt } from '@agentbrain-harness/api-remotes/client'
import { RpcId } from '@agentbrain-harness/client-connection/client'
import type { SnapshotSelectorHook } from '@agentbrain-harness/client-ui-slots'
import { PendingQuestion, type QuestionComposerProps } from '../src/client/contract/slots.ts'
import { QuestionComposer, parseRecommendedLabel } from '../src/client/QuestionComposer.tsx'
import { en, nl } from '../src/client/locales.ts'
import { en as commonEn } from '@agentbrain-harness/client-locale/src/locales/en.ts'
import { nl as commonNl } from '@agentbrain-harness/client-locale/src/locales/nl.ts'

afterEach(cleanup)

const SID = 's1' as SessionId

/** Seat stub over a dictionary pair mirroring the real lookup chain: package dictionary, then common vocabulary, then the key. */
const seatOver = (dict: Record<string, string>, common: Record<string, string>): QuestionComposerProps['t'] =>
  (key => dict[key] ?? common[key] ?? key)

/** Framework standard-kit stubs: the composer consumes only the locale seat;
 *  the composed props type mandates delivery of the rest (framework hooks are
 *  plain stubs per the client testing discipline). */
const kit = {
  session: undefined,
  sessionId: SID,
  useSession: (() => { throw new Error('unused') }) as unknown as SnapshotSelectorHook<ConversationSnapshot>,
  useSessions: (() => { throw new Error('unused') }) as unknown as SnapshotSelectorHook<SessionListState>,
  useWorkspaces: (() => { throw new Error('unused') }) as unknown as SnapshotSelectorHook<WorkspaceListState>,
  useProjection: (() => undefined) as never,
  useInput: (() => { throw new Error('unused') }) as never,
  inputActions: { setDraft: () => { throw new Error('unused') }, submit: () => { throw new Error('unused') } } as never,
  // The seat's key domain is question ∪ common.
  t: seatOver(nl, commonNl),
}

const QUESTIONS = [
  {
    id: 'profile', header: 'Voorkeur', question: 'Selecteer kandidaatstype',
    detail: 'Selecteer op basis van de prioriteit van de openstaande vacature.',
    options: [
      { label: 'Technische uitvoering (Recommended)', description: 'Prioriteit bij technische oplevering.' },
      { label: 'Onderzoekspotentieel', description: 'Prioriteit bij onderzoekscapaciteit.' },
    ],
  },
  {
    id: 'detail', question: 'Voeg uw vereisten toe',
  },
  {
    id: 'signals', question: 'Selecteer belangrijke signalen (meerdere keuzes mogelijk)', multiSelect: true,
    options: [{ label: 'Systeemontwerp' }, { label: 'Codekwaliteit' }, { label: 'Productoordeel' }],
  },
]

/** Carrier fixture: a real PendingWait over a scripted respond carrier. */
function wait(rpcId = 'question-1', respond = vi.fn(() => Promise.resolve<RpcReceipt>({ accepted: true }))) {
  const carrier = new PendingWait(
    'question', RpcId(rpcId), SID, { questions: QUESTIONS }, respond)
  return { carrier, respond }
}

/** The client-response envelope respond must have received for an answer batch. */
function answeredEnvelope(rpcId: string, answers: object[]) {
  return {
    type: 'client-response', rpcId: RpcId(rpcId),
    result: { ok: true, value: { sessionId: SID, answer: { answers } } },
  }
}

describe('QuestionComposer', () => {
  it('collects single, custom, and multi-select answers before one batch submit', () => {
    const { carrier, respond } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    expect(screen.getByText('Voorkeur')).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeTruthy()
    expect(screen.getByText('Aanbevolen')).toBeTruthy()
    expect(screen.getByText('Technische uitvoering')).toBeTruthy()
    const detail = screen.getByText('Selecteer op basis van de prioriteit van de openstaande vacature.')
    const scrollRegion = detail.closest('[data-question-scroll]')
    expect(scrollRegion).toBeTruthy()
    expect(scrollRegion?.contains(screen.getByRole('radio', { name: /Technische uitvoering/ }))).toBe(true)
    expect(scrollRegion?.contains(screen.getByText('Volgende').closest('button'))).toBe(false)
    fireEvent.keyDown(screen.getByRole('radio', { name: /Technische uitvoering/ }), { key: 'Enter' })
    expect(respond).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: /Technische uitvoering/ }))

    expect(screen.getByText('2 / 3')).toBeTruthy()
    // detail is per-question: the second question carries none.
    expect(screen.queryByText('Selecteer op basis van de prioriteit van de openstaande vacature.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Antwoord invullen' })).toBeNull()
    const custom = screen.getByPlaceholderText('Typ je antwoord')
    fireEvent.change(custom, { target: { value: 'Zelfstandig online problemen kunnen oplossen' } })
    fireEvent.keyDown(custom, { key: 'Enter' })

    expect(screen.getByText('3 / 3')).toBeTruthy()
    // The model's question text renders verbatim — no marker filtering.
    expect(screen.getByText('Selecteer belangrijke signalen (meerdere keuzes mogelijk)')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Systeemontwerp' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Systeemontwerp' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Systeemontwerp' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Codekwaliteit' }))
    const multiCustom = screen.getByPlaceholderText('Typ je antwoord')
    fireEvent.change(multiCustom, { target: { value: 'Communicatievaardigheden' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Productoordeel' }))
    expect(screen.getByRole('checkbox', { name: 'Systeemontwerp' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'Codekwaliteit' }).getAttribute('aria-checked')).toBe('true')
    expect((multiCustom as HTMLInputElement).value).toBe('Communicatievaardigheden')
    fireEvent.keyDown(multiCustom, { key: 'Enter' })

    // The domain face encoded the whole batch into one carrier envelope.
    expect(respond).toHaveBeenCalledWith(answeredEnvelope('question-1', [
      { id: 'profile', selected: ['Technische uitvoering (Recommended)'] },
      { id: 'detail', selected: [], custom: 'Zelfstandig online problemen kunnen oplossen' },
      { id: 'signals', selected: ['Systeemontwerp', 'Codekwaliteit', 'Productoordeel'], custom: 'Communicatievaardigheden' },
    ]))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Bezig met verzenden…' }).disabled).toBe(true)
  })

  it('renders plan detail through the shared assistant Markdown primitive', () => {
    const carrier = new PendingWait(
      'question',
      RpcId('markdown-plan'),
      SID,
      {
        questions: [{
          id: 'plan',
          question: 'Goedkeuren van dit plan?',
          detail: '# Implementatieplan\n\n- **Eerst valideren** huidige staat\n- Aanpassen `QuestionComposer`',
          options: [{ label: 'Goedkeuren' }],
        }],
      },
      vi.fn(),
    )
    const view = render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Implementatieplan' })).toBeTruthy()
    expect(view.container.querySelector('strong')?.textContent).toBe('Eerst valideren')
    expect(view.container.querySelector('code')?.textContent).toBe('QuestionComposer')
    expect(view.container.querySelectorAll('li')).toHaveLength(2)
  })

  it('skips individual questions without discarding earlier answers', () => {
    const { carrier, respond } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    expect((screen.getByText('Volgende').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Onderzoekspotentieel' }))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Deze vraag overslaan' }))
    expect(screen.getByText('3 / 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Deze vraag overslaan' }))

    expect(respond).toHaveBeenCalledWith(answeredEnvelope('question-1', [
      { id: 'profile', selected: ['Onderzoekspotentieel'] },
      { id: 'detail', selected: [] },
      { id: 'signals', selected: [] },
    ]))
  })

  it('keeps IME Enter inside the custom input until composition finishes', () => {
    const { carrier, respond } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Onderzoekspotentieel' }))
    const custom = screen.getByPlaceholderText('Typ je antwoord')
    fireEvent.change(custom, { target: { value: '中文输入' } })

    fireEvent.keyDown(custom, { key: 'Enter', isComposing: true })
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(respond).not.toHaveBeenCalled()

    fireEvent.keyDown(custom, { key: 'Enter', keyCode: 229 })
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(respond).not.toHaveBeenCalled()

    fireEvent.keyDown(custom, { key: 'Enter' })
    expect(screen.getByText('3 / 3')).toBeTruthy()
  })

  it('shows the inline custom input, reports missing answers, and supports pager navigation', () => {
    const { carrier, respond } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    expect(screen.getByPlaceholderText('Typ je antwoord')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Technische uitvoering' }))
    const emptyCustom = screen.getByPlaceholderText('Typ je antwoord')
    fireEvent.keyDown(emptyCustom, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('2 / 3')).toBeTruthy()
    fireEvent.keyDown(emptyCustom, { key: 'Enter' })
    expect(screen.getByText('Selecteer een option of voer een aangepast antwoord in.')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Volgende vraag'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Productoordeel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verzenden' }))
    expect(screen.getByText('Beantwoord deze vraag eerst.')).toBeTruthy()
    expect(screen.getByText('2 / 3')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Vorige vraag'))
    expect(screen.getByText('1 / 3')).toBeTruthy()
    expect(respond).not.toHaveBeenCalled()
  })

  it('surfaces cancellation failures: rejected receipt text and raw transport reasons', async () => {
    const respond = vi.fn()
      .mockResolvedValueOnce({ accepted: false, reason: 'bad-response' })
      .mockRejectedValueOnce(new Error('Tweede annulering mislukt'))
    const { carrier } = wait('question-1', respond)
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)

    // Receipt rejection surfaces through the domain face's thrown message.
    fireEvent.click(screen.getByRole('button', { name: 'Alle vragen sluiten' }))
    expect(await screen.findByText('question cancellation rejected: bad-response')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Deze vraag overslaan' }).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Alle vragen sluiten' }))
    expect(await screen.findByText('Tweede annulering mislukt')).toBeTruthy()
  })

  it('surfaces transport rejection and resets local drafts for a different request', async () => {
    const respond = vi.fn()
      .mockRejectedValueOnce(new Error('Netwerkverbinding verbroken'))
      .mockRejectedValueOnce('Tekenreeksfout')
    const first = wait('first', respond)
    const view = render(<QuestionComposer matched={first.carrier} interactions={[first.carrier]} {...kit} />)

    fireEvent.click(screen.getByRole('radio', { name: /Onderzoekspotentieel/ }))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    const second = wait('second', respond)
    view.rerender(<QuestionComposer matched={second.carrier} interactions={[second.carrier]} {...kit} />)
    expect(screen.getByRole('radio', { name: /Onderzoekspotentieel/ }).getAttribute('aria-checked')).toBe('false')

    fireEvent.click(screen.getByRole('radio', { name: /Technische uitvoering/ }))
    const custom = screen.getByPlaceholderText('Typ je antwoord')
    fireEvent.change(custom, { target: { value: 'x' } })
    fireEvent.keyDown(custom, { key: 'Enter' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Systeemontwerp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verzenden' }))
    expect(respond).toHaveBeenNthCalledWith(1, answeredEnvelope('second', [
      { id: 'profile', selected: ['Technische uitvoering (Recommended)'] },
      { id: 'detail', selected: [], custom: 'x' },
      { id: 'signals', selected: ['Systeemontwerp'] },
    ]))
    expect(await screen.findByText('Netwerkverbinding verbroken')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Verzenden' }).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Verzenden' }))
    expect(await screen.findByText('Tekenreeksfout')).toBeTruthy()
  })

  it('renders chrome copy through the English dictionary', () => {
    const respond = vi.fn(() => Promise.resolve<RpcReceipt>({ accepted: true }))
    const carrier = new PendingWait(
      'question', RpcId('solo'), SID, { questions: [{ id: 'detail', question: 'Voeg uw vereisten toe' }] }, respond)
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} t={seatOver(en, commonEn)} />)
    expect(screen.getByLabelText('Dismiss all questions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip this question' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Type your answer')).toBeTruthy()
  })

  it('same-key carrier replacement (baseline replay) keeps drafts', () => {
    const first = wait('same-id')
    const view = render(<QuestionComposer matched={first.carrier} interactions={[first.carrier]} {...kit} />)
    fireEvent.click(screen.getByRole('radio', { name: /Onderzoekspotentieel/ }))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    // Replay mints a NEW carrier for the same request; same key = no remount.
    const replayed = wait('same-id')
    view.rerender(<QuestionComposer matched={replayed.carrier} interactions={[replayed.carrier]} {...kit} />)
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })
})

describe('PendingQuestion domain face', () => {
  it('encodes the answer batch into the ok envelope and throws on a rejected receipt', async () => {
    const respond = vi.fn()
      .mockResolvedValueOnce({ accepted: true })
      .mockResolvedValueOnce({ accepted: false, reason: 'not-pending' })
    const question = new PendingQuestion(wait('rq', respond).carrier)
    const batch = { answers: [{ id: 'mode', selected: ['Fast'] }] }
    await expect(question.answer(batch)).resolves.toBeUndefined()
    expect(respond).toHaveBeenCalledWith(answeredEnvelope('rq', batch.answers))
    await expect(question.answer(batch)).rejects.toThrow(/question response rejected: not-pending/)
  })

  it('encodes cancellation as the cancelled error envelope and throws on a rejected receipt', async () => {
    const respond = vi.fn()
      .mockResolvedValueOnce({ accepted: true })
      .mockResolvedValueOnce({ accepted: false, reason: 'bad-response' })
    const question = new PendingQuestion(wait('rc', respond).carrier)
    await expect(question.cancel()).resolves.toBeUndefined()
    expect(respond).toHaveBeenCalledWith({
      type: 'client-response', rpcId: RpcId('rc'),
      result: {
        ok: false,
        error: { code: 'cancelled', message: 'the user closed this question request', details: {} },
      },
    })
    await expect(question.cancel()).rejects.toThrow(/question cancellation rejected: bad-response/)
  })

  it('forwards key and questions from the carrier', () => {
    const question = new PendingQuestion(wait('rk').carrier)
    expect(question.key).toBe('q:rk')
    expect(question.questions).toBe(wait('rk').carrier.payload.questions)
  })

  it('collapses the card to the header strip and expands it back', () => {
    const { carrier } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)
    // Expanded: the option list is visible.
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    // Collapse: options leave the tree; the title and minimize toggle stay.
    fireEvent.click(screen.getByLabelText(nl['nav.minimize']))
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByText('Selecteer kandidaatstype')).toBeTruthy()
    // Expand: the options return (the toggle label flips while collapsed).
    fireEvent.click(screen.getByLabelText(nl['nav.maximize']))
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    // Expanded again: the toggle reports expanded and the option list is back.
    expect(screen.getByLabelText(nl['nav.minimize']).getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the collapse toggle out of the cancel path and preserves drafts across collapse', () => {
    const { carrier, respond } = wait()
    render(<QuestionComposer matched={carrier} interactions={[carrier]} {...kit} />)
    fireEvent.click(screen.getByRole('radio', { name: /Technische uitvoering/ }))
    // Single-select auto-advances to the second question; collapse and expand
    // must not lose either the picked option or the current position.
    fireEvent.click(screen.getByLabelText(nl['nav.minimize']))
    fireEvent.click(screen.getByLabelText(nl['nav.maximize']))
    const custom = screen.getByPlaceholderText(nl['custom.placeholder'])
    fireEvent.change(custom, { target: { value: 'Zelfstandig online problemen kunnen oplossen' } })
    // Re-expanding must not steal focus back into the textarea: it was
    // autofocused on first presentation, so focus stays on the expand toggle.
    expect(document.activeElement).not.toBe(custom)
    fireEvent.click(screen.getByLabelText('Volgende vraag'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Systeemontwerp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verzenden' }))
    expect(respond).toHaveBeenCalledWith(answeredEnvelope('question-1', [
      { id: 'profile', selected: ['Technische uitvoering (Recommended)'] },
      { id: 'detail', custom: 'Zelfstandig online problemen kunnen oplossen', selected: [] },
      { id: 'signals', selected: ['Systeemontwerp'] },
    ]))
  })
})

describe('parseRecommendedLabel', () => {
  it('recognizes English and Dutch suffixes without changing ordinary labels', () => {
    expect(parseRecommendedLabel('Fast (Recommended)')).toEqual({ label: 'Fast', recommended: true })
    expect(parseRecommendedLabel('Veilig（Aanbevolen）')).toEqual({ label: 'Veilig', recommended: true })
    expect(parseRecommendedLabel('Veilig (Aanbevolen)')).toEqual({ label: 'Veilig', recommended: true })
    expect(parseRecommendedLabel('Plain')).toEqual({ label: 'Plain', recommended: false })
  })
})
