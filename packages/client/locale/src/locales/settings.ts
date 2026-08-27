/** `settings.locale` namespace dictionaries (the Language row's copy). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'language.title': 'Taal',
} satisfies Record<string, string>

/** The settings.locale namespace key union. */
export type SettingsLocaleKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'language.title': 'Language',
} satisfies Record<SettingsLocaleKey, string>
