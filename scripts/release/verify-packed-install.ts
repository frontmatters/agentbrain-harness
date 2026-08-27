/**
 * Install packed tarballs into a throwaway consumer outside the repository and
 * drive the installed executable with plain Node.
 *
 * Every tarball the installed tree needs comes from `--from`, so the only
 * registry traffic is for external dependencies. That matters beyond hermetic
 * verification: the harness packages declare the vendored framework as a peer,
 * those packages live in another release sequence, and this job must not depend
 * on the registry already carrying versions that match — one pull request may
 * bump both families before either publishes — so a abh verification passes the
 * vendored family's pack output too, while publishing only its own
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 *
 * What this proves is that `files` selected a complete payload and that the
 * published dependency ranges resolve. A workspace link or a stale `lib/` in the
 * checkout cannot stand in for a missing file here.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { capture, isEntry } from './process.ts'
import { packedIdentity } from './tarball.ts'

/**
 * Environment for the installed artifact: no host Node hooks, no host DeepSeek
 * Harness home, and no ambient npm user agent that would confuse npm.
 * @param consumerRoot - the throwaway consumer directory.
 * @returns The child environment.
 */
function consumerEnvironment(consumerRoot: string): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.npm_config_user_agent
  delete environment.NPM_CONFIG_USER_AGENT
  delete environment.NODE_OPTIONS
  delete environment.NODE_PATH
  environment.ABH_HOME = resolve(consumerRoot, '.abh')
  environment.ABH_AGENTS_HOME = resolve(consumerRoot, '.agents')
  environment.ABH_TELEMETRY_DISABLED = '1'
  return environment
}

/**
 * Every packed tarball in the given directories, as `file:` dependency entries.
 *
 * The directories are read by their contents rather than a pack order file: a
 * directory here can hold tarballs packed only to satisfy a cross-sequence
 * dependency, which no release order describes.
 * @param directories - absolute directories holding packed tarballs.
 * @returns Package name to tarball file URL, and the version each carries.
 */
function packedDependencies(directories: readonly string[]): Map<string, { url: string; version: string }> {
  const dependencies = new Map<string, { url: string; version: string }>()
  for (const directory of directories) {
    const tarballs = readdirSync(directory).filter(name => name.endsWith('.tgz')).sort()
    if (tarballs.length === 0) throw new Error(`${directory} holds no packed tarball`)
    for (const filename of tarballs) {
      const tarball = join(directory, filename)
      const { name, version } = packedIdentity(tarball)
      dependencies.set(name, { url: pathToFileURL(tarball).href, version })
    }
  }
  return dependencies
}

/**
 * Keep Koffi's host prebuild while the rehearsal omits Landlock optionals.
 * Koffi puts its native package in optionalDependencies too; omitting all
 * optionals makes its install hook compile from source instead of using the
 * prebuild. This is a verifier-only direct dependency, not a product edge.
 */
function hostKoffiDependency(): Record<string, string> {
  const platformPackage = `@koromix/koffi-${process.platform}-${process.arch}`
  const manifestPath = resolve(process.cwd(), 'packages/session/session-persistence-jsonl/package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, unknown>
  }
  const version = manifest.dependencies?.koffi
  if (typeof version !== 'string') return {}
  const supported = new Set([
    'darwin-arm64', 'darwin-x64',
    'linux-arm64', 'linux-x64',
    'win32-arm64', 'win32-x64', 'win32-ia32',
    'freebsd-arm64', 'freebsd-x64', 'freebsd-ia32',
    'openbsd-x64', 'openbsd-ia32',
  ])
  return supported.has(`${process.platform}-${process.arch}`)
    ? { [platformPackage]: version }
    : {}
}

/** Install every tarball under `--from` and drive the `--family` entry. */
function main(): void {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, from: { type: 'string', multiple: true } },
    allowPositionals: false,
  })
  if (values.family === undefined || values.from === undefined || values.from.length === 0) {
    throw new Error('usage: verify-packed-install.ts --family <abh|vendor> --from <packed directory> [--from ...]')
  }

  const family = releaseFamily(values.family)
  const entry = family.installedEntry
  if (entry === undefined) {
    console.log(`release verify-packed-install: family ${family.id} publishes no executable, nothing to drive`)
    return
  }

  const root = process.cwd()
  const packed = packedDependencies(values.from.map(directory => resolve(root, directory)))
  const expected = packed.get(entry.packageName)
  if (expected === undefined) throw new Error(`${entry.packageName} is not among the packed tarballs`)

  const consumerRoot = mkdtempSync(join(tmpdir(), `abh-packed-${family.id}-`))
  try {
    const dependencies = Object.fromEntries([...packed].map(([name, entryPacked]) => [name, entryPacked.url]))
    Object.assign(dependencies, hostKoffiDependency())
    writeFileSync(join(consumerRoot, 'package.json'), `${JSON.stringify({
      name: `abh-packed-install-${family.id}`,
      version: '0.0.0',
      private: true,
      dependencies,
    }, null, 2)}\n`)

    const environment = consumerEnvironment(consumerRoot)
    console.log(`release verify-packed-install: installing ${String(packed.size)} tarball(s) into ${consumerRoot}`)
    // Optional dependencies are omitted so the rehearsal does not require
    // unbuilt Landlock binaries for every architecture. hostKoffiDependency()
    // keeps Koffi's matching native prebuild as a normal dependency because
    // omitting it would invoke Koffi's source compiler during install.
    capture('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false', '--omit=optional'],
      { cwd: consumerRoot, env: environment })

    const bin = join(consumerRoot, 'node_modules', ...entry.packageName.split('/'), entry.binPath)
    const version = capture(process.execPath, [bin, '--version'], { cwd: consumerRoot, env: environment })
    if (version !== expected.version) {
      throw new Error(`installed ${entry.packageName} --version reported ${JSON.stringify(version)}, expected ${expected.version}`)
    }
    console.log(`release verify-packed-install: installed ${entry.packageName} reports ${version}`)
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true })
  }
}

if (isEntry(import.meta.url)) main()
