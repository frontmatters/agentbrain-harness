/** `skill` namespace dictionaries for the dedicated tool row. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'skill'

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'row.running': 'Skill wordt geladen',
  'row.failed': 'Laden van skill mislukt',
  'row.stopped': 'Laden van skill gestopt',
  'row.instructions': 'Instructies',
  'menu.userOnly': 'alleen gebruiker',
} satisfies Record<string, string>

/** The skill namespace key union. */
export type SkillKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'row.running': 'Loading skill',
  'row.failed': 'Skill load failed',
  'row.stopped': 'Skill load stopped',
  'row.instructions': 'Instructions',
  'menu.userOnly': 'user-only',
} satisfies Record<SkillKey, string>
