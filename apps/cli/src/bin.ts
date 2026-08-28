#!/usr/bin/env node
/**
 * abh — command-line entry. Dynamic imports per mode keep unrelated modes out
 * of each dispatch path; the adapter prints and exits for
 * `--help`/`--version`/a parse error, so only a valid mode reaches the switch.
 * @module @agentbrain-harness/abh/bin
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv } from '@agentbrain-harness/app-boot'
import { parseDshArgs } from './args.ts'

// Both the source tree (apps/cli/src) and the bundled bin (apps/cli/lib) sit
// one directory under apps/cli, so the checked-in manifest resolves with the
// same relative hop from either artifact.
/** This app's version, read from its checked-in package.json. */
function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version?: unknown }
  return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
}

const invocation = parseDshArgs(process.argv.slice(2), readVersion())

switch (invocation.mode) {
  case 'profile': {
    const { runProfile } = await import('./profile-boot.ts')
    let args = invocation.args
    // The web surface is a long-running server: reconcile against an already
    // running one so repeat starts do not stack stale-bundle servers on
    // different ports. A stale lock (dead pid) is dropped by the guard itself.
    if (invocation.profile === 'web') {
      const { ensureSingleWebInstance, clearInstanceLock, realWebLockDeps } = await import('./web-instance-lock.ts')
      const deps = realWebLockDeps()
      args = await ensureSingleWebInstance(invocation.args, deps)
      process.once('exit', () => { clearInstanceLock(deps) })
    }
    await runProfile({
      environment: loadLayeredEnv('abh'),
      profile: invocation.profile,
      patchFiles: invocation.patches,
      args,
    })
    break
  }
  case 'plugin': {
    const { runPlugin } = await import('./plugin.ts')
    process.exit(runPlugin(invocation.profile, invocation.args))
    break
  }
  case 'dump-config': {
    const { runDumpConfig } = await import('./dump-config.ts')
    runDumpConfig(invocation.profile, invocation.defaultOnly, invocation.patches)
    break
  }
  default:
    invocation satisfies never
    throw new Error(`abh: unhandled invocation mode ${JSON.stringify(invocation)}`)
}
