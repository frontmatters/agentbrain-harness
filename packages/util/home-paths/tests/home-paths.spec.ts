import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ABH_HOME_DISPLAY,
  ABH_HOME_DIR_NAME,
  resolveAgentBrainHome,
  canonicalizeWatchPath,
  defaultDshHome,
  abhHomeDisplay,
  abhHomePath,
  expandHomePath,
  resolveDshHome,
} from '@agentbrain-harness/home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('abh path helpers', () => {
  it('owns the shared default ABH home directory name', () => {
    expect(ABH_HOME_DIR_NAME).toBe('.abh')
    expect(DEFAULT_ABH_HOME_DISPLAY).toBe('~/.abh')
    expect(defaultDshHome()).toBe(join(homedir(), '.abh'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.abh')).toBe(join(homedir(), '.abh'))
    expect(expandHomePath('~\\.abh')).toBe(join(homedir(), '.abh'))
    expect(expandHomePath('/tmp/.abh')).toBe('/tmp/.abh')
    expect(expandHomePath('~other/.abh')).toBe('~other/.abh')
  })

  it('resolves explicit path before ABH_HOME and the default', () => {
    const envHome = join(homedir(), 'env-dsh')

    expect(resolveDshHome('/tmp/explicit-dsh', { ABH_HOME: '~/env-dsh' })).toBe(resolve('/tmp/explicit-dsh'))
    expect(resolveDshHome(undefined, { ABH_HOME: '~/env-dsh' })).toBe(envHome)
    expect(resolveDshHome(undefined, {})).toBe(defaultDshHome())
  })

  it('treats an empty or whitespace-only ABH_HOME as unset', () => {
    expect(resolveDshHome(undefined, { ABH_HOME: '' })).toBe(defaultDshHome())
    expect(resolveDshHome(undefined, { ABH_HOME: '   ' })).toBe(defaultDshHome())
  })

  it('resolves AgentBrain checkout roots with canonical environment semantics', () => {
    expect(resolveAgentBrainHome('/tmp/explicit-brain', { AGENTBRAIN_DIR: '/tmp/dir', AGENTBRAIN_HOME: '/tmp/home' })).toBe('/tmp/explicit-brain')
    expect(resolveAgentBrainHome(undefined, { AGENTBRAIN_DIR: '~/dir', AGENTBRAIN_HOME: '~/home' })).toBe(join(homedir(), 'dir'))
    expect(resolveAgentBrainHome(undefined, { AGENTBRAIN_HOME: '~/home' })).toBe(join(homedir(), 'home', 'agentBrain'))
  })

  it('treats blank AgentBrain overrides as unset', () => {
    expect(resolveAgentBrainHome(undefined, { AGENTBRAIN_DIR: ' ', AGENTBRAIN_HOME: '   ' })).toBe(resolveAgentBrainHome(undefined, {}))
  })

  it('joins child segments onto the resolved ABH_HOME', () => {
    vi.stubEnv('ABH_HOME', '~/env-dsh')
    expect(abhHomePath()).toBe(join(homedir(), 'env-dsh'))
    expect(abhHomePath('storages', 'cache')).toBe(join(homedir(), 'env-dsh', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(abhHomeDisplay(resolve(defaultDshHome()))).toBe('~/.abh')
    expect(abhHomeDisplay('/some/other/root')).toBe('$ABH_HOME')
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abh-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
