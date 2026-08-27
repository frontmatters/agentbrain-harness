/** `sidebar` namespace dictionaries: shell controls (brand row, New Session, fold toggle). */

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'session.new': 'Nieuwe sessie',
  'session.new.label': 'Nieuwe sessie',
  'toggle.open': 'Sidebar openen',
  'toggle.collapse': 'Sidebar inklappen',
} satisfies Record<string, string>

/** The sidebar namespace key union. */
export type SidebarKey = keyof typeof nl

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'session.new': 'New Session',
  'session.new.label': 'New session',
  'toggle.open': 'Open sidebar',
  'toggle.collapse': 'Collapse sidebar',
} satisfies Record<SidebarKey, string>
