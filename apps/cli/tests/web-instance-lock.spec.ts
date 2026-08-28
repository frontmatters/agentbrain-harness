import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearInstanceLock,
  ensureSingleWebInstance,
  parseWebPort,
  readRunningInstance,
  realWebLockDeps,
  webLockPath,
  withWebPort,
  type WebLockDeps,
} from '../src/web-instance-lock.ts'

/** A mock deps object over an in-memory file map and controllable process/port state. */
function mock(overrides: Partial<WebLockDeps> = {}): {
  deps: WebLockDeps
  files: Map<string, string>
  terminated: number[]
} {
  const files = new Map<string, string>()
  const terminated: number[] = []
  const deps: WebLockDeps = {
    readFile: path => files.get(path),
    writeFile: (path, content) => { files.set(path, content) },
    removeFile: (path) => { files.delete(path) },
    isAlive: () => true,
    terminate: (pid) => { terminated.push(pid) },
    isPortFree: async () => true,
    sleep: async () => {},
    ask: async () => '',
    isTTY: true,
    log: () => {},
    ...overrides,
  }
  return { deps, files, terminated }
}

describe('parseWebPort / withWebPort', () => {
  it('reads --port and --port= and falls back to the default', () => {
    expect(parseWebPort([])).toBe(3080)
    expect(parseWebPort(['--port', '5210'])).toBe(5210)
    expect(parseWebPort(['--no-open', '--port=4321'])).toBe(4321)
    expect(parseWebPort(['--port', 'nope'])).toBe(3080)
  })

  it('replaces an existing port flag rather than duplicating it', () => {
    expect(withWebPort(['--port', '3080', '--no-open'], 5210)).toEqual(['--no-open', '--port', '5210'])
    expect(withWebPort(['--port=3080'], 5210)).toEqual(['--port', '5210'])
    expect(withWebPort(['--no-open'], 5210)).toEqual(['--no-open', '--port', '5210'])
  })
})

describe('readRunningInstance', () => {
  it('returns undefined and cleans a missing, malformed, or dead-pid lock', () => {
    const absent = mock()
    expect(readRunningInstance(absent.deps)).toBeUndefined()

    const malformed = mock()
    malformed.files.set(webLockPath(), 'not json')
    expect(readRunningInstance(malformed.deps)).toBeUndefined()
    expect(malformed.files.has(webLockPath())).toBe(false)

    const dead = mock({ isAlive: () => false })
    dead.files.set(webLockPath(), JSON.stringify({ pid: 4242, port: 3080 }))
    expect(readRunningInstance(dead.deps)).toBeUndefined()
    expect(dead.files.has(webLockPath())).toBe(false)
  })

  it('returns a live recorded instance', () => {
    const live = mock({ isAlive: () => true })
    live.files.set(webLockPath(), JSON.stringify({ pid: 4242, port: 3080 }))
    expect(readRunningInstance(live.deps)).toEqual({ pid: 4242, port: 3080 })
  })
})

describe('clearInstanceLock', () => {
  it('removes only a lock owned by this process', () => {
    const ours = mock()
    ours.files.set(webLockPath(), JSON.stringify({ pid: process.pid, port: 3080 }))
    clearInstanceLock(ours.deps)
    expect(ours.files.has(webLockPath())).toBe(false)

    const other = mock()
    other.files.set(webLockPath(), JSON.stringify({ pid: 4242, port: 3080 }))
    clearInstanceLock(other.deps)
    expect(other.files.has(webLockPath())).toBe(true)
  })
})

describe('ensureSingleWebInstance', () => {
  it('writes the lock and keeps args when nothing is running', async () => {
    const { deps, files } = mock()
    const args = await ensureSingleWebInstance(['--no-open'], deps)
    expect(args).toEqual(['--no-open'])
    expect(JSON.parse(files.get(webLockPath())!)).toEqual({ pid: process.pid, port: 3080 })
  })

  it('stops the existing instance by default and starts on the requested port', async () => {
    const { deps, terminated } = mock({ isAlive: () => true, ask: async () => '' })
    ;(deps.readFile as unknown) = (path: string) => path === webLockPath() ? JSON.stringify({ pid: 4242, port: 3080 }) : undefined
    const args = await ensureSingleWebInstance(['--port', '5210'], deps)
    expect(terminated).toContain(4242)
    expect(parseWebPort(args)).toBe(5210)
  })

  it('leaves the existing instance and picks a free port when the operator declines', async () => {
    const freeFrom = 3081
    const { deps } = mock({
      isAlive: () => true,
      ask: async () => 'n',
      isPortFree: async port => port === freeFrom,
    })
    deps.readFile = path => path === webLockPath() ? JSON.stringify({ pid: 4242, port: 3080 }) : undefined
    const args = await ensureSingleWebInstance([], deps)
    expect(parseWebPort(args)).toBe(freeFrom)
  })

  it('picks a free port without prompting when no terminal is present', async () => {
    const { deps, terminated } = mock({
      isAlive: () => true,
      isTTY: false,
      isPortFree: async port => port === 3081,
    })
    deps.readFile = path => path === webLockPath() ? JSON.stringify({ pid: 4242, port: 3080 }) : undefined
    const args = await ensureSingleWebInstance([], deps)
    expect(terminated).toEqual([])
    expect(parseWebPort(args)).toBe(3081)
  })
})

describe('realWebLockDeps', () => {
  const dirs: string[] = []
  afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

  it('creates the Harness home directory when writing the lock on a first run', async () => {
    const base = await mkdtemp(join(tmpdir(), 'abh-lock-'))
    dirs.push(base)
    const deps = realWebLockDeps()
    const lockPath = join(base, 'fresh-home', 'web.lock')
    expect(existsSync(join(base, 'fresh-home'))).toBe(false)
    deps.writeFile(lockPath, JSON.stringify({ pid: 1, port: 3080 }))
    expect(deps.readFile(lockPath)).toBe(JSON.stringify({ pid: 1, port: 3080 }))
  })
})
