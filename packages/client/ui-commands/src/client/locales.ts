/** `command` namespace dictionaries (the popupSelect shell's copy). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'search.placeholder': 'Zoeken…',
  'search.aria': 'Filter opties',
  'status.loading': 'Opties laden…',
  'status.applying': 'Toepassen…',
  'status.empty': 'Geen opties',
  'overlay.aria': '/{command} opties',
  'listbox.aria': '/{command} overeenkomsten',
  'notice.imagesUnsupported': '/{command} accepteert geen afbeeldingsbijlagen; verwijder ze eerst',
} satisfies Record<string, string>

/** The command namespace key union. */
export type CommandKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'search.placeholder': 'Search…',
  'search.aria': 'Filter options',
  'status.loading': 'Loading options…',
  'status.applying': 'Applying…',
  'status.empty': 'No options',
  'overlay.aria': '/{command} options',
  'listbox.aria': '/{command} matches',
  'notice.imagesUnsupported': '/{command} does not accept image attachments; remove them first',
} satisfies Record<CommandKey, string>
