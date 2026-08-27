/** `settings.permission` namespace dictionaries (the Permission row's copy). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'title': 'Permission',
  'description': 'Kies de standaard permission mode voor nieuwe sessies',
  'loading': 'Laden',
  'unavailable': 'Niet beschikbaar',
  'confirm.title': 'Full access inschakelen?',
  'confirm.description': 'Met Full access worden in nieuwe sessies minder bevestigingsstappen gevraagd en kunnen meer acties direct worden uitgevoerd, waaronder gevoelige bewerkingen, bestandswijzigingen of externe opdrachten. Gebruik dit alleen als je de volgende taken vertrouwt.',
  'confirm.acknowledge': 'Ik begrijp de risico\'s en wil doorgaan',
  'confirm.cancel': 'Annuleren',
  'confirm.enable': 'Full access inschakelen',
} satisfies Record<string, string>

/** The settings.permission namespace key union. */
export type PermissionSettingsKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'title': 'Permission',
  'description': 'Choose the default permission mode for new sessions',
  'loading': 'Loading',
  'unavailable': 'Unavailable',
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access lets new sessions reduce confirmation steps and perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust subsequent tasks.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
} satisfies Record<PermissionSettingsKey, string>

/** Dutch dictionary for the current-session popup gate. */
export const accessNl = {
  'confirm.title': 'Full access inschakelen?',
  'confirm.description': 'Met Full access worden minder bevestigingsstappen gevraagd en kan de agent meer acties direct uitvoeren, waaronder gevoelige bewerkingen, bestandswijzigingen of externe opdrachten. Gebruik dit alleen als je de huidige taak vertrouwt.',
  'confirm.acknowledge': 'Ik begrijp de risico\'s en wil doorgaan',
  'confirm.cancel': 'Annuleren',
  'confirm.enable': 'Full access inschakelen',
} satisfies Record<string, string>

/** Current-session popup-gate key union. */
export type PermissionAccessKey = keyof typeof accessNl

/** English dictionary for the current-session popup gate. */
export const accessEn = {
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
} satisfies Record<PermissionAccessKey, string>
