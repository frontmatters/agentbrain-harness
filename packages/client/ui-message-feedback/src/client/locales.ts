/** `feedback` namespace dictionaries. */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'action.like': 'Goede reactie',
  'action.likeActive': 'Beoordeling verwijderen',
  'action.dislike': 'Slechte reactie',
  'action.dislikeActive': 'Beoordeling verwijderen',
  'note.open': 'Note toevoegen',
  'note.dialog': 'Feedback',
  'note.placeholder': 'Wat ging goed, of wat ging er mis? (optioneel)',
  'note.save': 'Opslaan',
  'note.cancel': 'Annuleren',
  'note.aria': 'Feedback note',
  'error.conflict': 'Deze feedback is elders gewijzigd; de laatste stand wordt getoond',
  'error.load': 'Feedback kon niet worden geladen',
  'error.generic': 'Feedback kon niet worden opgeslagen',
} satisfies Record<string, string>

/** The feedback namespace key union. */
export type MessageFeedbackKey = keyof typeof nl

declare module '@agentbrain-harness/client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The per-message feedback controls' copy. */
    feedback: MessageFeedbackKey
  }
}

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'action.like': 'Good response',
  'action.likeActive': 'Remove rating',
  'action.dislike': 'Bad response',
  'action.dislikeActive': 'Remove rating',
  'note.open': 'Add a note',
  'note.dialog': 'Feedback',
  'note.placeholder': 'What was good, or what went wrong? (optional)',
  'note.save': 'Save',
  'note.cancel': 'Cancel',
  'note.aria': 'Feedback note',
  'error.conflict': 'This feedback changed elsewhere; the latest state is shown',
  'error.load': 'Could not load feedback',
  'error.generic': 'Could not save feedback',
} satisfies Record<MessageFeedbackKey, string>
