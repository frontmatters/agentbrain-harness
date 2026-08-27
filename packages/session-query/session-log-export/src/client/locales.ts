/** Locale namespace owned by Session export browser feedback. */
export const NS = 'session-log-download'

/** Dutch Session export strings (the key-set source of truth). */
export const nl = {
  'dialog.preparingTitle': 'Session exporteren',
  'dialog.preparingDescription': 'Een ZIP voorbereiden met deze Session, de sub-Sessions en bijlagen.',
  'dialog.successTitle': 'Download van Session gestart',
  'dialog.successDescription': 'De browser downloadt de Session-ZIP.',
  'dialog.errorTitle': 'Session exporteren mislukt',
  'dialog.close': 'Sluiten',
  'dialog.commandFailed': 'De Session-export kon niet worden gestart.',
} as const

/** English Session export strings. */
export const en: Record<keyof typeof nl, string> = {
  'dialog.preparingTitle': 'Exporting Session',
  'dialog.preparingDescription': 'Preparing a ZIP containing this Session, its sub-Sessions, and attachments.',
  'dialog.successTitle': 'Session download started',
  'dialog.successDescription': 'The browser is downloading the Session ZIP.',
  'dialog.errorTitle': 'Session export failed',
  'dialog.close': 'Close',
  'dialog.commandFailed': 'Could not start the Session export.',
}

/** Stable locale keys consumed by the shared modal. */
export type SessionLogDownloadKey = keyof typeof nl
