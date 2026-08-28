/** Copy dictionaries for the plugin inventory Settings section. */

/** Dutch dictionary and key source of truth. */
export const nl = {
  tab: 'Plugin-lijst',
  loading: 'Plugins laden…',
  error: 'Plugins zijn tijdelijk niet beschikbaar.',
  retry: 'Opnieuw proberen',
  search: 'Plugins zoeken',
  catalog: 'Plugin-lijst',
  empty: 'Geen plugins beschikbaar.',
  emptySearch: 'Geen overeenkomende plugins.',
  enabledTag: 'Ingeschakeld',
  disabledTag: 'Uitgeschakeld',
  configuration: 'Configuratie',
  cordis: 'Cordis-status',
  unobserved: 'Niet gemount',
  pending: 'Wacht op afhankelijkheden',
  loadingPhase: 'Laden',
  active: 'Gemount',
  failed: 'Mounten mislukt',
  unloading: 'Unmounten',
  enable: 'Inschakelen',
  disable: 'Uitschakelen',
  toggleHint: 'Wijziging wordt direct toegepast.',
} satisfies Record<string, string>

/** Plugin inventory locale key union. */
export type PluginInventoryLocaleKey = keyof typeof nl

/** English dictionary checked against the Dutch key set. */
export const en = {
  tab: 'Plugin list',
  loading: 'Reading plugins…',
  error: 'Plugins are temporarily unavailable.',
  retry: 'Retry',
  search: 'Search plugins',
  catalog: 'Plugin list',
  empty: 'No plugins are available.',
  emptySearch: 'No matching plugins.',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  configuration: 'Configuration',
  cordis: 'Cordis status',
  unobserved: 'Not mounted',
  pending: 'Waiting for dependencies',
  loadingPhase: 'Loading',
  active: 'Mounted',
  failed: 'Mount failed',
  unloading: 'Unloading',
  enable: 'Enable',
  disable: 'Disable',
  toggleHint: 'Applied live.',
} satisfies Record<PluginInventoryLocaleKey, string>
