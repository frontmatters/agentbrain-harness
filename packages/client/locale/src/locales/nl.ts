/** nl base dictionary for the common namespace: cross-feature standard words. */
export const nl = {
  'ok': 'OK',
  'cancel': 'Annuleren',
  'close': 'Sluiten',
  'copy': 'Kopiëren',
  'copied': 'Gekopieerd',
  'retry': 'Opnieuw proberen',
  'loading': 'Laden…',
  'load.failed': 'Laden mislukt',
  'submit': 'Verzenden',
  'submitting': 'Bezig met verzenden…',
  'next': 'Volgende',
  'previous': 'Vorige',
  'skip': 'Overslaan',
  'delete': 'Verwijderen',
  'edit': 'Bewerken',
  'save': 'Opslaan',
  'search': 'Zoeken',
  'more': 'Meer',
  'collapse': 'Inklappen',
  'expand': 'Uitklappen',
  'back': 'Terug',
  'unknown': 'Onbekend',
  'none': 'Geen',
  'truncated': 'Afgekapt',
} satisfies Record<string, string>

/** The common vocabulary key union (nl is the key-set source of truth). */
export type CommonKey = keyof typeof nl
