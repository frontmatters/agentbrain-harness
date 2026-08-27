/** `plan` namespace dictionaries (the composer plan chip's copy). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'chip.on.aria': 'Plan mode aan, klik om uit te zetten',
  'chip.on.title': 'Plan mode aan — klik om uit te zetten (/plan off)',
  'chip.off.aria': 'Plan mode uit, klik om aan te zetten',
  'chip.off.title': 'Plan mode uit — klik om aan te zetten (/plan)',
} satisfies Record<string, string>

/** The plan namespace key union. */
export type PlanKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'chip.on.aria': 'Plan mode on, press to turn off',
  'chip.on.title': 'Plan mode on — click to turn off (/plan off)',
  'chip.off.aria': 'Plan mode off, press to turn on',
  'chip.off.title': 'Plan mode off — click to turn on (/plan)',
} satisfies Record<PlanKey, string>
