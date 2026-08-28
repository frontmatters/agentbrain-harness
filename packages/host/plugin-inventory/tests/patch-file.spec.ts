import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readPatchList, upsertTogglePatch, writePatchList } from '../src/patch-file.ts'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

async function tempFile(name = 'cordis.patch.yml'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'abh-patch-'))
  dirs.push(dir)
  return join(dir, name)
}

describe('readPatchList', () => {
  it('returns an empty list when the file is absent', async () => {
    expect(await readPatchList(join(await tempFile(), 'missing.yml'))).toEqual([])
  })

  it('returns an empty list for an empty file', async () => {
    const path = await tempFile()
    await writeFile(path, '', 'utf8')
    expect(await readPatchList(path)).toEqual([])
  })

  it('parses a patch sequence and preserves a !!js expression through a round-trip', async () => {
    const path = await tempFile()
    await writeFile(path, '- id: foo\n  config:\n    home: !!js process.env.HOME\n', 'utf8')
    const rows = await readPatchList(path)
    expect(rows).toEqual([{ id: 'foo', config: { home: { __jsExpr: 'process.env.HOME' } } }])
    await writePatchList(path, rows)
    expect(await readFile(path, 'utf8')).toContain('!!js process.env.HOME')
  })

  it('throws when the file is not a YAML sequence', async () => {
    const path = await tempFile()
    await writeFile(path, 'id: not-a-list\n', 'utf8')
    await expect(readPatchList(path)).rejects.toThrow('expected a YAML sequence')
  })

  it('propagates a non-ENOENT read error', async () => {
    // A directory path yields EISDIR, not ENOENT, so the read must reject.
    const dir = await mkdtemp(join(tmpdir(), 'abh-patch-'))
    dirs.push(dir)
    await expect(readPatchList(dir)).rejects.toThrow()
  })
})

describe('upsertTogglePatch', () => {
  it('adds a disable patch when none exists', () => {
    expect(upsertTogglePatch([], 'foo', false)).toEqual([{ id: 'foo', disabled: true }])
  })

  it('adds an enable patch persisted as disabled false', () => {
    expect(upsertTogglePatch([], 'foo', true)).toEqual([{ id: 'foo', disabled: false }])
  })

  it('replaces an existing toggle patch for the same id', () => {
    const rows = [{ id: 'foo', disabled: true }]
    expect(upsertTogglePatch(rows, 'foo', true)).toEqual([{ id: 'foo', disabled: false }])
  })

  it('preserves an unrelated patch and a non-toggle patch for the same id', () => {
    const rows = [{ id: 'bar', disabled: true }, { id: 'foo', config: { key: 1 } }]
    expect(upsertTogglePatch(rows, 'foo', false)).toEqual([
      { id: 'bar', disabled: true },
      { id: 'foo', config: { key: 1 } },
      { id: 'foo', disabled: true },
    ])
  })
})

describe('writePatchList', () => {
  it('serializes rows the reader can parse back', async () => {
    const path = await tempFile()
    await writePatchList(path, [{ id: 'foo', disabled: true }])
    expect(await readPatchList(path)).toEqual([{ id: 'foo', disabled: true }])
  })
})
