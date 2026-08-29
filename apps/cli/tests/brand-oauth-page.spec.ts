import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BRANDED_SHA256, ORIGINAL_SHA256, brandOauthPage, decideAction, findPiAiOauthPage, sha256,
} from '../postinstall/brand-oauth-page.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const brandedAsset = join(here, '..', 'postinstall', 'oauth-page.branded.js')
const originalFixture = join(here, 'fixtures', 'oauth-page.original.js')
const PAGE_SUFFIX = join('node_modules', '@earendil-works', 'pi-ai', 'dist', 'auth', 'oauth', 'oauth-page.js')

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

/**
 * A consumer install layout: pi-ai's page seeded with `content` at the project
 * root's node_modules, and a nested start dir mirroring where the postinstall
 * runs (`node_modules/@agentbrain-harness/abh/postinstall`).
 */
function fakeInstall(content?: Buffer): { startDir: string; pagePath: string } {
  const root = mkdtempSync(join(tmpdir(), 'abh-piai-'))
  dirs.push(root)
  const pagePath = join(root, PAGE_SUFFIX)
  if (content !== undefined) {
    mkdirSync(join(pagePath, '..'), { recursive: true })
    writeFileSync(pagePath, content)
  }
  const startDir = join(root, 'node_modules', '@agentbrain-harness', 'abh', 'postinstall')
  mkdirSync(startDir, { recursive: true })
  return { startDir, pagePath }
}

describe('brand-oauth-page constants', () => {
  it('the constants match the shipped branded asset and the vetted original', () => {
    expect(sha256(readFileSync(brandedAsset))).toBe(BRANDED_SHA256)
    expect(sha256(readFileSync(originalFixture))).toBe(ORIGINAL_SHA256)
    expect(BRANDED_SHA256).not.toBe(ORIGINAL_SHA256)
  })
})

describe('decideAction', () => {
  it('brands a pristine page, skips an already-branded one, and leaves an unknown one alone', () => {
    expect(decideAction(ORIGINAL_SHA256)).toBe('brand')
    expect(decideAction(BRANDED_SHA256)).toBe('already-branded')
    expect(decideAction('deadbeef')).toBe('skip')
  })
})

describe('findPiAiOauthPage', () => {
  it('walks up node_modules to the installed page', () => {
    const { startDir, pagePath } = fakeInstall(Buffer.from('x'))
    expect(findPiAiOauthPage(startDir)).toBe(pagePath)
  })

  it('returns undefined when pi-ai is not installed', () => {
    const { startDir } = fakeInstall(undefined)
    expect(findPiAiOauthPage(startDir)).toBeUndefined()
  })
})

describe('brandOauthPage', () => {
  it('rewrites a pristine callback page with the branded copy', () => {
    const { startDir, pagePath } = fakeInstall(readFileSync(originalFixture))
    expect(brandOauthPage(startDir, brandedAsset)).toBe('brand')
    expect(sha256(readFileSync(pagePath))).toBe(BRANDED_SHA256)
  })

  it('leaves an already-branded page untouched', () => {
    const branded = readFileSync(brandedAsset)
    const { startDir, pagePath } = fakeInstall(branded)
    expect(brandOauthPage(startDir, brandedAsset)).toBe('already-branded')
    expect(readFileSync(pagePath).equals(branded)).toBe(true)
  })

  it('leaves a page pi-ai has changed untouched (keeps pi-ai version, unbranded)', () => {
    const changed = Buffer.from('// a future pi-ai oauth-page\nexport const x = 1\n')
    const { startDir, pagePath } = fakeInstall(changed)
    expect(brandOauthPage(startDir, brandedAsset)).toBe('skip')
    expect(readFileSync(pagePath).equals(changed)).toBe(true)
  })

  it('reports not-found when pi-ai is absent', () => {
    const { startDir } = fakeInstall(undefined)
    expect(brandOauthPage(startDir, brandedAsset)).toBe('not-found')
  })
})
