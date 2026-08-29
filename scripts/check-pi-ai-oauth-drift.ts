/**
 * Drift detector for the pi-ai OAuth callback page branding.
 *
 * `apps/cli`'s postinstall re-brands pi-ai's `oauth-page.js` only when the
 * installed file is byte-identical to a vetted original (`ORIGINAL_SHA256`).
 * When pi-ai ships a new `oauth-page.js`, the gate silently stops branding until
 * the shipped copy and the two hashes are refreshed. This check fetches the
 * latest `@earendil-works/pi-ai` from the registry, hashes its callback page,
 * and fails loudly when it no longer matches the vetted original — turning a
 * silent branding loss into an explicit "re-vendor needed" signal.
 *
 * It hits the network and tracks a moving upstream, so it is a scheduled/manual
 * maintainer check, never part of the offline unit gate. Exit 0 means the brand
 * still covers the latest pi-ai; exit 1 means the page drifted (or the fetch
 * failed) and someone must re-vet `oauth-page.branded.js`.
 * @module scripts/check-pi-ai-oauth-drift
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORIGINAL_SHA256 } from '../apps/cli/postinstall/brand-oauth-page.mjs'

const PACKAGE = '@earendil-works/pi-ai'
const PAGE = join('package', 'dist', 'auth', 'oauth', 'oauth-page.js')

/** Pack the latest published `@earendil-works/pi-ai` and return its callback page hash and version. */
function latestOauthPage() {
  const dir = mkdtempSync(join(tmpdir(), 'pi-ai-drift-'))
  try {
    const version = execFileSync('npm', ['view', PACKAGE, 'version'], { encoding: 'utf8' }).trim()
    execFileSync('npm', ['pack', `${PACKAGE}@${version}`, '--pack-destination', dir], { stdio: 'ignore' })
    const tarball = execFileSync('ls', [dir], { encoding: 'utf8' }).split('\n').find(name => name.endsWith('.tgz'))
    execFileSync('tar', ['xzf', join(dir, tarball ?? ''), '-C', dir])
    return { version, sha256: createHash('sha256').update(readFileSync(join(dir, PAGE))).digest('hex') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  let latest
  try {
    latest = latestOauthPage()
  } catch (error) {
    process.stderr.write(`pi-ai oauth drift: could not fetch ${PACKAGE}: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
  if (latest.sha256 === ORIGINAL_SHA256) {
    process.stdout.write(`pi-ai oauth drift: ${PACKAGE}@${latest.version} still matches the vetted page; branding covers it.\n`)
    return
  }
  process.stderr.write(
    `pi-ai oauth drift: ${PACKAGE}@${latest.version} changed oauth-page.js.\n`
    + `  vetted original: ${ORIGINAL_SHA256}\n`
    + `  latest:          ${latest.sha256}\n`
    + '  Re-vendor apps/cli/postinstall/oauth-page.branded.js from the new original and update ORIGINAL_SHA256/BRANDED_SHA256.\n',
  )
  process.exit(1)
}

/* v8 ignore next -- network-driven maintainer entry, not part of the unit gate. */
if (fileURLToPath(import.meta.url) === process.argv[1]) main()
