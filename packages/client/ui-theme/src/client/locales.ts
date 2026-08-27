/** `settings.theme` namespace dictionaries (the Appearance row's copy). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'appearance.title': 'Weergave',
  'appearance.light': 'Licht',
  'appearance.dark': 'Donker',
  'appearance.system': 'Systeem',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
} satisfies Record<ThemeKey, string>
