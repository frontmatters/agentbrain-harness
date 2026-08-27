/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'trigger': 'Instellingen',
  'title': 'Instellingen',
  'close': 'Sluiten',
  'openDocument': 'Open configuratiebestand',
  'openDocument.error': 'Kan het configuratiebestand niet openen',
  'general.nav': 'Algemeen',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
} satisfies Record<SettingsKey, string>
