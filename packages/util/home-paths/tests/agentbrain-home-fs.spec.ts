/**
 * Covers the existsSync-gated fallback branches in resolveAgentBrainHome
 * (lines 95-97 of index.ts) which depend on whether the stable alias or the
 * legacy checkout path is present on disk. Using vi.mock to intercept the
 * node:fs import so tests are hermetic regardless of the developer's machine.
 */
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AGENTBRAIN_ALIAS,
  LEGACY_AGENTBRAIN_ROOT,
  resolveAgentBrainHome,
} from '@agentbrain-harness/home-paths'

const existsSyncControl = vi.hoisted(() => ({
  defaultAliasExists: false,
  legacyRootExists: false,
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync(path: Parameters<typeof actual.existsSync>[0]): boolean {
      if (path === DEFAULT_AGENTBRAIN_ALIAS) return existsSyncControl.defaultAliasExists
      if (path === LEGACY_AGENTBRAIN_ROOT) return existsSyncControl.legacyRootExists
      return actual.existsSync(path)
    },
  }
})

describe('resolveAgentBrainHome filesystem fallbacks', () => {
  it('returns the stable alias when it exists and no env vars are set', () => {
    existsSyncControl.defaultAliasExists = true
    existsSyncControl.legacyRootExists = false
    expect(resolveAgentBrainHome(undefined, {})).toBe(resolve(DEFAULT_AGENTBRAIN_ALIAS))
  })

  it('returns the legacy root when the stable alias is absent but the legacy path exists', () => {
    existsSyncControl.defaultAliasExists = false
    existsSyncControl.legacyRootExists = true
    expect(resolveAgentBrainHome(undefined, {})).toBe(resolve(LEGACY_AGENTBRAIN_ROOT))
  })

  it('falls back to the stable alias path when neither filesystem path exists', () => {
    existsSyncControl.defaultAliasExists = false
    existsSyncControl.legacyRootExists = false
    expect(resolveAgentBrainHome(undefined, {})).toBe(resolve(DEFAULT_AGENTBRAIN_ALIAS))
  })
})
