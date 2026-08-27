/** Locale bundles for the plugin configuration section and its plugin cards. */

/** Locale keys these surfaces render. */
export type PluginsSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'configurableTab' | 'empty'
  | 'overridden' | 'reset' | 'readOnly' | 'expand' | 'collapse'
  | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'invalidNumber'
  | 'bashTitle' | 'bashDescription' | 'bashTimeoutMs' | 'bashTimeoutMsHint'
  | 'bashMaxOutputBytes' | 'bashMaxOutputBytesHint'
  | 'agentLoopTitle' | 'agentLoopDescription' | 'agentLoopMaxParallel' | 'agentLoopMaxParallelHint'
  | 'webSearchTitle' | 'webSearchDescription'
  | 'webSearchApiKey' | 'webSearchApiKeyHint' | 'webSearchApiKeySet' | 'webSearchApiKeyUnset'
  | 'webSearchBaseUrl' | 'webSearchBaseUrlHint' | 'webSearchMaxUses' | 'webSearchMaxUsesHint'

/** English copy. */
export const en: Record<PluginsSettingsLocaleKey, string> = {
  nav: 'Plugins',
  title: 'Plugins',
  intro: 'Configure and inspect the plugins installed in this deployment.',
  tabs: 'Plugin views',
  configurableTab: 'Plugin configuration',
  empty: 'This deployment exposes no plugin settings.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  unsaved: 'Unsaved',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
  bashTitle: 'Shell',
  bashDescription: 'Limits every command the agent runs.',
  bashTimeoutMs: 'Command timeout (ms)',
  bashTimeoutMsHint: 'How long one command may run before it is terminated.',
  bashMaxOutputBytes: 'Output cap per stream (bytes)',
  bashMaxOutputBytesHint: 'Output beyond this spills to a temporary file rather than being lost.',
  agentLoopTitle: 'Agent loop',
  agentLoopDescription: 'How the agent dispatches tool calls.',
  agentLoopMaxParallel: 'Parallel tool calls',
  agentLoopMaxParallelHint: 'Upper bound on parallel-safe calls running at once within one step.',
  webSearchTitle: 'Web search',
  webSearchDescription: 'Configure the web search provider.',
  webSearchApiKey: 'API key',
  webSearchApiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  webSearchApiKeySet: 'A key is configured.',
  webSearchApiKeyUnset: 'No key is configured; search is unavailable until one is.',
  webSearchBaseUrl: 'Endpoint',
  webSearchBaseUrlHint: 'Leave blank to use the provider default.',
  webSearchMaxUses: 'Max searches per request',
  webSearchMaxUsesHint: 'How many times one request may search before it must answer.',
}

/** Dutch copy. */
export const nl: Record<PluginsSettingsLocaleKey, string> = {
  nav: 'Plugins',
  title: 'Plugins',
  intro: 'Configureer en bekijk de plugins die in deze deployment zijn geïnstalleerd.',
  tabs: 'Plugin-weergaven',
  configurableTab: 'Plugin-configuratie',
  empty: 'Deze deployment heeft geen plugin-instellingen beschikbaar.',
  overridden: 'Overschreven',
  reset: 'Terugzetten naar standaard',
  readOnly: 'Deze deployment slaat instellingen op als alleen-lezen.',
  expand: 'Instellingen tonen',
  collapse: 'Instellingen verbergen',
  save: 'Opslaan',
  saving: 'Opslaan…',
  discard: 'Verwerpen',
  unsaved: 'Niet opgeslagen',
  saveFailed: 'De deployment heeft deze waarden niet geaccepteerd; ze zijn bewaard zodat je ze kunt corrigeren.',
  invalidNumber: 'Voer een getal in, of laat leeg om de standaard te gebruiken.',
  bashTitle: 'Shell',
  bashDescription: 'Beperkt elke opdracht die de agent uitvoert.',
  bashTimeoutMs: 'Opdracht-timeout (ms)',
  bashTimeoutMsHint: 'Hoe lang één opdracht mag draaien voordat deze wordt afgebroken.',
  bashMaxOutputBytes: 'Uitvoerlimiet per stream (bytes)',
  bashMaxOutputBytesHint: 'Uitvoer boven deze limiet wordt naar een tijdelijk bestand geschreven in plaats van weggegooid.',
  agentLoopTitle: 'Agent loop',
  agentLoopDescription: 'Hoe de agent tool calls verdeelt.',
  agentLoopMaxParallel: 'Parallel tool calls',
  agentLoopMaxParallelHint: 'Maximum aantal parallel-veilige calls dat tegelijk binnen één stap actief is.',
  webSearchTitle: 'Web search',
  webSearchDescription: 'Configureer de web search provider.',
  webSearchApiKey: 'API key',
  webSearchApiKeyHint: 'Opgeslagen buiten het instellingenbestand. Laat leeg om de huidige sleutel te behouden.',
  webSearchApiKeySet: 'Er is een sleutel geconfigureerd.',
  webSearchApiKeyUnset: 'Er is geen sleutel geconfigureerd; search is niet beschikbaar totdat er een is ingesteld.',
  webSearchBaseUrl: 'Endpoint',
  webSearchBaseUrlHint: 'Laat leeg om de standaard van de provider te gebruiken.',
  webSearchMaxUses: 'Maximaal aantal zoekopdrachten per verzoek',
  webSearchMaxUsesHint: 'Hoe vaak één verzoek mag zoeken voordat het een antwoord moet geven.',
}
