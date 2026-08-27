/**
 * Shared filesystem path helpers for agentBrain Harness user data.
 *
 * @module @agentbrain-harness/home-paths
 */

import { opendir, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

/** Directory name for the default agentBrain Harness home under the OS home. */
export const ABH_HOME_DIR_NAME = '.abh'

/** Stable user-facing display form for the default agentBrain Harness home. */
export const DEFAULT_ABH_HOME_DISPLAY = `~/${ABH_HOME_DIR_NAME}`

/** Environment variable that overrides the default agentBrain Harness home. */
export const ABH_HOME_ENV = 'ABH_HOME'

/** Environment variable containing the AgentBrain checkout root. */
export const AGENTBRAIN_DIR_ENV = 'AGENTBRAIN_DIR'

/** Environment variable containing the AgentBrain install/config parent. */
export const AGENTBRAIN_HOME_ENV = 'AGENTBRAIN_HOME'

/** Stable user-facing AgentBrain checkout alias. */
export const DEFAULT_AGENTBRAIN_ALIAS = join(homedir(), 'agentBrain')

/** Maintainer checkout fallback used when the stable alias is absent. */
export const LEGACY_AGENTBRAIN_ROOT = join(homedir(), 'Developer', 'agentBrain')

/**
 * Give a native filesystem watcher one canonical spelling of a path, even
 * when its final components do not exist yet. The deepest existing ancestor
 * is resolved through {@link realpath}; when a suffix is missing, that
 * ancestor is also proved to be an enumerable directory before the suffix is
 * restored. This prevents Windows from treating a regular-file ancestor as
 * ordinary absence, and prevents short-name aliases from being mixed with
 * long paths emitted by the native watcher backend.
 * @param path - Watch target or root, resolved against the current directory.
 * @returns the target with its existing ancestor canonicalized.
 * @throws when ancestor traversal encounters an error other than absence, or
 * the existing ancestor of a missing suffix is not an enumerable directory.
 */
export async function canonicalizeWatchPath(path: string): Promise<string> {
  let current = resolve(path)
  const missing: string[] = []
  while (true) {
    try {
      const canonical = await realpath(current)
      if (missing.length > 0) {
        // A Windows file-as-parent probe reports ENOENT. Opening the resolved
        // ancestor preserves the cross-platform directory requirement.
        const directory = await opendir(canonical)
        await directory.close()
      }
      return join(canonical, ...missing.reverse())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const parent = dirname(current)
      /* v8 ignore next -- a filesystem root exists, so traversal resolves before this guard */
      if (parent === current) throw error
      missing.push(basename(current))
      current = parent
    }
  }
}

/**
 * Resolve the default agentBrain Harness home using Node's platform path rules.
 * @returns the absolute default harness home path.
 */
export function defaultDshHome(): string {
  return join(homedir(), ABH_HOME_DIR_NAME)
}

/**
 * Resolve the AgentBrain checkout root using AgentBrain's environment contract.
 *
 * Precedence, highest first: explicit configuration, `AGENTBRAIN_DIR`, the
 * `AGENTBRAIN_HOME/agentBrain` convention, the stable `~/agentBrain` alias,
 * and the legacy `~/Developer/agentBrain` checkout. Existing aliases are
 * preferred so consumers share the same checkout as native AgentBrain clients.
 * @param configured - explicit checkout-root override.
 * @param env - environment mapping used to read AgentBrain variables.
 * @returns the selected absolute AgentBrain checkout root.
 */
export function resolveAgentBrainHome(configured?: string, env: Record<string, string | undefined> = process.env): string {
  if (configured !== undefined && configured.trim().length > 0) return resolve(expandHomePath(configured))
  const directory = env[AGENTBRAIN_DIR_ENV]
  if (directory !== undefined && directory.trim().length > 0) return resolve(expandHomePath(directory))
  const installHome = env[AGENTBRAIN_HOME_ENV]
  if (installHome !== undefined && installHome.trim().length > 0) return resolve(join(expandHomePath(installHome), 'agentBrain'))
  if (existsSync(DEFAULT_AGENTBRAIN_ALIAS)) return resolve(DEFAULT_AGENTBRAIN_ALIAS)
  if (existsSync(LEGACY_AGENTBRAIN_ROOT)) return resolve(LEGACY_AGENTBRAIN_ROOT)
  return resolve(DEFAULT_AGENTBRAIN_ALIAS)
}

/**
 * Expand supported tilde prefixes against the operating-system home.
 * @param path - configured path that may begin with `~`, `~/`, or `~\`.
 * @returns the expanded path, or the original value when no supported prefix is present.
 */
export function expandHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/**
 * Resolve the single-root agentBrain Harness home.
 *
 * Precedence, highest first: an explicit configured path, `$ABH_HOME`, then
 * `~/.abh`. The harness keeps all user data under one root. An empty or
 * whitespace-only `$ABH_HOME` is treated as unset, so a blank override never
 * resolves the home to the current working directory.
 * @param configured - explicit harness-home override, which has highest precedence.
 * @param env - environment mapping used to read `ABH_HOME`.
 * @returns the normalized absolute harness home path.
 */
export function resolveDshHome(configured?: string, env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env[ABH_HOME_ENV]
  const selected = configured ?? (fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : defaultDshHome())
  return resolve(expandHomePath(selected))
}

/**
 * Join path segments onto the resolved agentBrain Harness home.
 * @param segments - path segments appended to the Harness home; an empty list returns the home itself.
 * @returns the normalized absolute joined path.
 */
export function abhHomePath(...segments: string[]): string {
  return join(resolveDshHome(), ...segments)
}

/**
 * Describe a resolved harness home symbolically for user-facing display.
 *
 * It never returns an absolute machine path: the default home is labelled
 * `~/.abh`, and any configured home is labelled `$ABH_HOME`.
 * @param resolvedHome - the absolute path returned by {@link resolveDshHome}.
 * @returns `~/.abh` for the default home, otherwise `$ABH_HOME`.
 */
export function abhHomeDisplay(resolvedHome: string): string {
  return resolvedHome === resolve(defaultDshHome()) ? DEFAULT_ABH_HOME_DISPLAY : `$${ABH_HOME_ENV}`
}
