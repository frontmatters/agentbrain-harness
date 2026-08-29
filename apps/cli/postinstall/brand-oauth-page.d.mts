/** Type declarations for the install-time OAuth-page branding module. */

/** SHA-256 of the pristine `oauth-page.js` this branding is vetted against. */
export const ORIGINAL_SHA256: string
/** SHA-256 of the branded `oauth-page.js` this postinstall writes. */
export const BRANDED_SHA256: string

/** Hex SHA-256 of a buffer or string. */
export function sha256(content: Uint8Array | string): string

/** Locate the installed pi-ai callback page by walking up `node_modules` from `startDir`. */
export function findPiAiOauthPage(startDir: string): string | undefined

/** Decide what to do with the installed callback page from its current hash. */
export function decideAction(currentSha: string): 'brand' | 'already-branded' | 'skip'

/**
 * Find the installed pi-ai callback page, gate on its content, and rewrite it
 * with the branded copy when it matches the vetted original.
 */
export function brandOauthPage(
  startDir: string,
  brandedPath: string,
): 'brand' | 'already-branded' | 'skip' | 'not-found'
