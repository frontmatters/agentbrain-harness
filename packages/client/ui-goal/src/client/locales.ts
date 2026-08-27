/** `goal` namespace dictionaries. */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'phase.active': 'Actief goal',
  'phase.paused': 'Gepauzeerd goal',
  'phase.blocked': 'Geblokkeerd goal',
  'objective.aria': 'Goal-omschrijving',
  'commandInput.aria': 'Opdrachtinvoer',
  'action.save': 'Goal opslaan',
  'action.cancel': 'Bewerking annuleren',
  'action.pause': 'Goal pauzeren',
  'action.resume': 'Goal hervatten',
  'action.edit': 'Goal bewerken',
  'action.clear': 'Goal wissen',
} satisfies Record<string, string>

/** The goal namespace key union. */
export type GoalKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'phase.active': 'Ongoing Goal',
  'phase.paused': 'Paused Goal',
  'phase.blocked': 'Blocked Goal',
  'objective.aria': 'Goal objective',
  'commandInput.aria': 'Command input',
  'action.save': 'Save goal',
  'action.cancel': 'Cancel edit',
  'action.pause': 'Pause goal',
  'action.resume': 'Resume goal',
  'action.edit': 'Edit goal',
  'action.clear': 'Clear goal',
} satisfies Record<GoalKey, string>
