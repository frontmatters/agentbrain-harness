/** Dutch copy dictionary for the AgentBrain addon settings tab. */
export const nl = {
  tab: 'AgentBrain-addons', loading: 'Addons laden…', error: 'Addons zijn tijdelijk niet beschikbaar.', retry: 'Opnieuw proberen', empty: 'Geen addons beschikbaar.', enable: 'Inschakelen', disable: 'Uitschakelen', enabled: 'Ingeschakeld', disabled: 'Uitgeschakeld', failed: 'Actie mislukt', confirmDisable: 'Addon uitschakelen?', check: 'Testen', checking: 'Testen…', healthy: 'Werkt', unhealthy: 'Probleem', suiteTest: 'Suite testen', skills: 'Skills', emptySkills: 'Geen skills beschikbaar.', errorSkills: 'Skills tijdelijk niet beschikbaar.', system: 'System', local: 'Local',
} satisfies Record<string, string>
/** Keys shared by the addon settings locale dictionaries. */
export type AddonsLocaleKey = keyof typeof nl
/** English copy dictionary for the AgentBrain addon settings tab. */
export const en = {
  tab: 'AgentBrain addons', loading: 'Loading addons…', error: 'Addons are temporarily unavailable.', retry: 'Retry', empty: 'No addons are available.', enable: 'Enable', disable: 'Disable', enabled: 'Enabled', disabled: 'Disabled', failed: 'Action failed', confirmDisable: 'Disable this addon?', check: 'Test', checking: 'Testing…', healthy: 'Working', unhealthy: 'Problem', suiteTest: 'Run tests', skills: 'Skills', emptySkills: 'No skills available.', errorSkills: 'Skills are temporarily unavailable.', system: 'System', local: 'Local',
} satisfies Record<AddonsLocaleKey, string>
