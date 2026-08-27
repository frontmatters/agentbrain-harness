/** `question` namespace dictionaries. */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'error.incomplete': 'Beantwoord deze vraag eerst.',
  'error.unanswered': 'Selecteer een option of voer een aangepast antwoord in.',
  'nav.prev': 'Vorige vraag',
  'nav.next': 'Volgende vraag',
  'nav.minimize': 'Vraagkaart inklappen',
  'nav.maximize': 'Vraagkaart uitklappen',
  'nav.cancel': 'Alle vragen sluiten',
  'option.recommended': 'Aanbevolen',
  'custom.placeholder': 'Typ je antwoord',
  'action.skip': 'Deze vraag overslaan',
  'action.next': 'Volgende',
  'plan.header': 'Plan beoordelen',
  'plan.approve': 'Goedkeuren',
  'plan.decline': 'Weigeren',
  'plan.discuss': 'Bespreken in chat',
} satisfies Record<string, string>

/** The question namespace key union. */
export type QuestionKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'error.incomplete': 'Please complete this question first.',
  'error.unanswered': 'Please select an option or enter a custom answer.',
  'nav.prev': 'Previous question',
  'nav.next': 'Next question',
  'nav.minimize': 'Collapse the question card',
  'nav.maximize': 'Expand the question card',
  'nav.cancel': 'Dismiss all questions',
  'option.recommended': 'Recommended',
  'custom.placeholder': 'Type your answer',
  'action.skip': 'Skip this question',
  'action.next': 'Next',
  'plan.header': 'Plan review',
  'plan.approve': 'Approve',
  'plan.decline': 'Refuse',
  'plan.discuss': 'Chat about it',
} satisfies Record<QuestionKey, string>
