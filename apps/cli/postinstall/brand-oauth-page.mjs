/**
 * Brand pi-ai's OAuth callback page on install.
 *
 * pi-ai (@earendil-works/pi-ai) serves its own confirmation page at the OAuth
 * loopback callback (openai-codex, anthropic, ...), carrying pi-ai's default
 * logo. In this monorepo a pnpm patch swaps that logo for the agentBrain mark,
 * but pnpm patches never ship to consumers who install the published packages,
 * so a fresh install shows pi-ai's original page. This postinstall reinstates
 * the brand for consumers.
 *
 * It is content-gated, never version-gated: it rewrites the callback page only
 * when the installed file is byte-identical to a pi-ai release we vetted, and it
 * is a no-op when the page is already branded or when pi-ai has changed it (a
 * changed page keeps pi-ai's own version, unbranded, rather than a stale brand).
 * `oauth-page.js` has been stable across many pi-ai releases, so one vetted
 * original covers a wide range. Any failure is swallowed: cosmetic branding must
 * never break a host install.
 * @module @agentbrain-harness/abh/postinstall/brand-oauth-page
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** SHA-256 of the pristine `oauth-page.js` this branding is vetted against (pi-ai 0.82.1–0.84.x). */
export const ORIGINAL_SHA256 = '42a64830cc90e228550cab0e765ea5e86653956912bc9197ce655c0685cf0b0c'
/** SHA-256 of the branded `oauth-page.js` this postinstall writes. */
export const BRANDED_SHA256 = 'e283c4a4bfabb11ed970231f0413246420cf2052656999d793681609a21e82bb'

/** Path suffix of pi-ai's OAuth callback page under a `node_modules` root. */
const PI_AI_OAUTH_PAGE = join('node_modules', '@earendil-works', 'pi-ai', 'dist', 'auth', 'oauth', 'oauth-page.js')

/** Hex SHA-256 of a buffer or string. */
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Locate the installed pi-ai callback page by walking up from `startDir` and
 * probing each ancestor's `node_modules`. pi-ai's `exports` map hides its files
 * from `require.resolve`, so this resolves on the filesystem instead.
 * @param startDir - directory to start the upward search from.
 * @returns the absolute page path, or undefined when pi-ai is not installed here.
 */
export function findPiAiOauthPage(startDir) {
  let dir = startDir
  for (;;) {
    const candidate = join(dir, PI_AI_OAUTH_PAGE)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Decide what to do with the installed callback page from its current hash.
 * @param currentSha - SHA-256 of the installed `oauth-page.js`.
 * @returns `'brand'` to rewrite it, `'already-branded'` or `'skip'` to leave it.
 */
export function decideAction(currentSha) {
  if (currentSha === BRANDED_SHA256) return 'already-branded'
  if (currentSha === ORIGINAL_SHA256) return 'brand'
  return 'skip'
}

/**
 * Find the installed pi-ai callback page, gate on its content, and rewrite it
 * with the branded copy when it matches the vetted original.
 * @param startDir - directory to resolve pi-ai from (the postinstall's own dir).
 * @param brandedPath - absolute path to the branded `oauth-page.js` to install.
 * @returns the action taken, for logging and tests.
 */
export function brandOauthPage(startDir, brandedPath) {
  const target = findPiAiOauthPage(startDir)
  if (target === undefined) return 'not-found'
  const action = decideAction(sha256(readFileSync(target)))
  if (action === 'brand') writeFileSync(target, readFileSync(brandedPath))
  return action
}

/* v8 ignore start -- install-time entry; the exported functions above are unit-tested. */
/** Whether this module is the process entry, tolerant of symlinked paths (macOS /tmp, npm dirs). */
function runAsEntry() {
  const self = fileURLToPath(import.meta.url)
  const argv = process.argv[1]
  if (argv === undefined) return false
  try {
    return realpathSync(self) === realpathSync(argv)
  } catch {
    return self === argv
  }
}
if (runAsEntry()) {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    brandOauthPage(here, join(here, 'oauth-page.branded.js'))
  } catch {
    // Cosmetic branding must never fail the host install.
  }
}
/* v8 ignore stop */
