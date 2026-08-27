/**
 * The common-namespace dictionary pair. nl is the source of truth for the
 * key set; en is checked complete against it — a missing or extra en key is
 * a compile error.
 */
export { nl } from './nl.ts'
export { en } from './en.ts'
export type { CommonKey } from './nl.ts'
