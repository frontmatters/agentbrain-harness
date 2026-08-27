/**
 * De-vendoring gate: the upstream npm scope must not reach any publish-critical
 * surface. A single occurrence in a manifest, an import specifier, or a cordis
 * config would either publish under the wrong scope or fail to resolve after
 * the rescope to `@agentbrain-harness`.
 *
 * Scope of the check (deliberately narrow, so it never false-fails):
 * - every tracked `package.json` (name, dependencies, peerDependencies, ...),
 * - every `.ts`/`.tsx` import, require, or dynamic-import specifier,
 * - every `.yml`/`.yaml` config (cordis plugin rows name packages here).
 *
 * Out of scope on purpose: prose, comments, generated notices, the rebrand and
 * rescope tooling that legitimately maps from the upstream scope, historical
 * Agent Notes, and test fixtures. Those keep the upstream name by intent; see
 * the explainer `devendoring-a-hard-fork` for the five contexts.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Build the upstream scope from parts so its literal text never appears in this
// file. A plain `git grep` for the scope, including the cheap de-vendoring check,
// then reports real hits and not this gate. The same construction is used by
// scripts/verify-public-repository-links.spec.ts.
const UPSTREAM_SCOPE = `@${['deepseek', 'ai'].join('-')}`

/** Tracked files only, so `node_modules`, `lib/`, and `dist/` never enter the scan. */
const trackedFiles: readonly string[] = execFileSync('git', ['ls-files'], {
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
}).split('\n').filter(name => name.length > 0)

/** Read a tracked file relative to the repository root (the vitest working directory). */
function read(file: string): string {
  return readFileSync(file, 'utf8')
}

describe('de-vendored npm scope', () => {
  it('no package.json names, requires, or depends on the upstream scope', () => {
    const hits = trackedFiles.filter(file =>
      file.endsWith('package.json') && read(file).includes(UPSTREAM_SCOPE))
    expect(hits).toEqual([])
  })

  it('no TypeScript module specifier imports the upstream scope', () => {
    const specifier = new RegExp(`(?:from|import|require)\\s*\\(?\\s*['"\`]${UPSTREAM_SCOPE}`)
    const hits = trackedFiles.filter(file =>
      /\.tsx?$/.test(file) && specifier.test(read(file)))
    expect(hits).toEqual([])
  })

  it('no cordis or yaml config references the upstream scope', () => {
    const hits = trackedFiles.filter(file =>
      /\.ya?ml$/.test(file) && read(file).includes(UPSTREAM_SCOPE))
    expect(hits).toEqual([])
  })
})
