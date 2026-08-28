/**
 * Single-instance guard for `abh web`. A long-running web server writes a lock
 * at `$ABH_HOME/web.lock` recording its pid and port. On the next `abh web`,
 * the guard reads that lock and, when the recorded process is still alive,
 * offers to stop it before starting here (the default), or to start on the next
 * free port instead. It stops repeat starts from silently stacking servers that
 * serve stale bundles from different ports.
 * @module @agentbrain-harness/abh/web-instance-lock
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@agentbrain-harness/home-paths'

/** The `abh web` default listen port; mirrors the cmdline `webStartup.port ?? 3080`. */
const DEFAULT_WEB_PORT = 3080

/** The lock file name under the Harness home. */
const WEB_LOCK_FILENAME = 'web.lock'

/** Absolute path of the web single-instance lock. */
export function webLockPath(): string {
  return join(resolveDshHome(), WEB_LOCK_FILENAME)
}

/** A recorded running web instance. */
export interface WebInstance {
  readonly pid: number
  readonly port: number
}

/** Injected side effects, so the guard's branches are testable without real processes or sockets. */
export interface WebLockDeps {
  /** Read a file, or undefined when it does not exist. */
  readFile: (path: string) => string | undefined
  /** Write a file. */
  writeFile: (path: string, content: string) => void
  /** Remove a file, ignoring a missing one. */
  removeFile: (path: string) => void
  /** Whether a pid names a live process (`process.kill(pid, 0)`). */
  isAlive: (pid: number) => boolean
  /** Ask a live process to exit (`SIGTERM`). */
  terminate: (pid: number) => void
  /** Whether a TCP port is free to bind. */
  isPortFree: (port: number) => Promise<boolean>
  /** Sleep for a bounded poll. */
  sleep: (ms: number) => Promise<void>
  /** Ask the operator a yes/no question; the answer text (empty string on bare Enter). */
  ask: (question: string) => Promise<string>
  /** Whether an operator is present to answer prompts. */
  isTTY: boolean
  /** Emit a status line to the operator. */
  log: (message: string) => void
}

/** The `--port <n>` or `--port=<n>` a web-app arg list requests, or the default. */
export function parseWebPort(args: readonly string[]): number {
  for (const [index, arg] of args.entries()) {
    if (arg === '--port') {
      const value = Number(args[index + 1])
      return Number.isInteger(value) && value >= 0 ? value : DEFAULT_WEB_PORT
    }
    if (arg.startsWith('--port=')) {
      const value = Number(arg.slice('--port='.length))
      return Number.isInteger(value) && value >= 0 ? value : DEFAULT_WEB_PORT
    }
  }
  return DEFAULT_WEB_PORT
}

/** Rewrite the arg list to request `port`, replacing an existing `--port` or appending one. */
export function withWebPort(args: readonly string[], port: number): string[] {
  const next: string[] = []
  let skipValue = false
  for (const arg of args) {
    if (skipValue) { skipValue = false; continue }
    if (arg === '--port') { skipValue = true; continue }
    if (arg.startsWith('--port=')) continue
    next.push(arg)
  }
  next.push('--port', String(port))
  return next
}

/** Read the recorded instance, returning it only when its process is still alive; a stale lock is removed. */
export function readRunningInstance(deps: WebLockDeps): WebInstance | undefined {
  const raw = deps.readFile(webLockPath())
  if (raw === undefined) return undefined
  let parsed: WebInstance
  try {
    const value = JSON.parse(raw) as Partial<WebInstance>
    if (typeof value.pid !== 'number' || typeof value.port !== 'number') throw new Error('malformed')
    parsed = { pid: value.pid, port: value.port }
  } catch {
    deps.removeFile(webLockPath())
    return undefined
  }
  if (parsed.pid === process.pid || !deps.isAlive(parsed.pid)) {
    deps.removeFile(webLockPath())
    return undefined
  }
  return parsed
}

/** Terminate a running instance and wait, bounded, until its process is gone. */
async function stopRunningInstance(pid: number, deps: WebLockDeps): Promise<void> {
  deps.terminate(pid)
  for (let attempt = 0; attempt < 30 && deps.isAlive(pid); attempt++) {
    await deps.sleep(100)
  }
}

/** The first free port at or after `from`, probed with the OS. */
async function nextFreePort(from: number, deps: WebLockDeps): Promise<number> {
  for (let port = from + 1; port < from + 50; port++) {
    if (await deps.isPortFree(port)) return port
  }
  return 0
}

/** Record this process as the running web instance. */
function writeInstanceLock(port: number, deps: WebLockDeps): void {
  deps.writeFile(webLockPath(), JSON.stringify({ pid: process.pid, port }))
}

/** Remove the lock when it still records this process. */
export function clearInstanceLock(deps: WebLockDeps): void {
  const raw = deps.readFile(webLockPath())
  if (raw === undefined) return
  try {
    const value = JSON.parse(raw) as Partial<WebInstance>
    if (value.pid === process.pid) deps.removeFile(webLockPath())
  } catch { /* a malformed lock is not ours to remove */ }
}

/**
 * Reconcile against any already-running web instance before this one binds, and
 * record this instance. Returns the web-app args to boot with, which carry a
 * different `--port` when the operator kept the existing instance running.
 * @param args - the web app's own args (may carry `--port`).
 * @param deps - injected side effects.
 * @returns the args to boot the web app with.
 */
export async function ensureSingleWebInstance(args: readonly string[], deps: WebLockDeps): Promise<string[]> {
  const existing = readRunningInstance(deps)
  let bootArgs = [...args]
  if (existing !== undefined) {
    const where = `PID ${existing.pid}, http://localhost:${existing.port}`
    if (deps.isTTY) {
      const answer = (await deps.ask(`abh web is already running (${where}). Stop it and start here? [Y/n] `)).trim().toLowerCase()
      if (answer === 'n' || answer === 'no') {
        const port = await nextFreePort(parseWebPort(bootArgs), deps)
        bootArgs = withWebPort(bootArgs, port)
        deps.log(`Left the existing instance running; starting on http://localhost:${port} instead.`)
      } else {
        await stopRunningInstance(existing.pid, deps)
        deps.log(`Stopped the existing web instance (PID ${existing.pid}).`)
      }
    } else {
      const port = await nextFreePort(parseWebPort(bootArgs), deps)
      bootArgs = withWebPort(bootArgs, port)
      deps.log(`abh web already running (${where}); starting on http://localhost:${port} instead (no terminal to confirm a stop).`)
    }
  }
  writeInstanceLock(parseWebPort(bootArgs), deps)
  return bootArgs
}

/** Real side effects for the running CLI. */
export function realWebLockDeps(): WebLockDeps {
  return {
    readFile: (path) => { try { return readFileSync(path, 'utf8') } catch { return undefined } },
    // On a first-ever run the Harness home does not exist yet, and the guard
    // writes the lock before the app boots and creates it, so ensure the parent.
    writeFile: (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content, 'utf8') },
    removeFile: (path) => { rmSync(path, { force: true }) },
    isAlive: (pid) => { try { process.kill(pid, 0); return true } catch { return false } },
    terminate: (pid) => { try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ } },
    isPortFree: port => new Promise((resolve) => {
      const server = createServer()
      server.once('error', () => { resolve(false) })
      server.once('listening', () => { server.close(() => { resolve(true) }) })
      server.listen(port, '127.0.0.1')
    }),
    sleep: ms => new Promise((resolve) => { setTimeout(resolve, ms) }),
    ask: async (question) => {
      const { createInterface } = await import('node:readline/promises')
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      try { return await rl.question(question) } finally { rl.close() }
    },
    isTTY: process.stdin.isTTY,
    log: (message) => { process.stderr.write(`${message}\n`) },
  }
}
