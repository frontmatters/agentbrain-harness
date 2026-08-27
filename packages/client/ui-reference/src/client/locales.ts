/** `reference` namespace dictionaries for the unified `@` source. */

import type {} from '@agentbrain-harness/client-ui-slots'

/** Dictionary namespace owned by this plugin. */
export const NS = 'reference'

/** Dutch dictionary (the key-set source of truth). */
export const nl = {
  'section.files': 'Bestanden & mappen',
  'section.sessions': 'Session gesprekken',
  'candidate.file': 'File',
  'candidate.folder': 'Map',
  'candidate.session': 'Session',
  'candidate.noCwd': '(geen werkmap)',
} satisfies Record<string, string>

/** The reference namespace key union. */
export type ReferenceKey = keyof typeof nl

declare module '@agentbrain-harness/client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The unified `@` reference menu's copy. */
    reference: ReferenceKey
  }
}

/** English dictionary, checked complete against the nl key set. */
export const en = {
  'section.files': 'Files & folders',
  'section.sessions': 'Session conversations',
  'candidate.file': 'File',
  'candidate.folder': 'Folder',
  'candidate.session': 'Session',
  'candidate.noCwd': '(no cwd)',
} satisfies Record<ReferenceKey, string>
