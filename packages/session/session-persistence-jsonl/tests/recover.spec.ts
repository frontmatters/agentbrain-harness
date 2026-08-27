import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import { mkdtemp, readFile, appendFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SessionStore from '@agentbrain-harness/session'
import type { SessionEvent } from '@agentbrain-harness/session'
import JsonlSessionPersistence from '@agentbrain-harness/session-persistence-jsonl'
import { logPath, scanLog } from '../src/format.ts'
import { compressZstdFrame, createZstdFrameDecoder, scanZstdFrames } from '../src/zstd.ts'
import { recoverLog } from '../src/recover.ts'
import { meta, oneTurnLog } from '../../session-persistence/tests/contract.ts'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

async function mount(): Promise<{ ctx: Context; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'abh-recover-'))
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'zstd' })
  return { ctx, root }
}

/** Concatenate the plaintext of every complete frame in a log buffer. */
async function decodeCompleteFrames(buffer: Buffer): Promise<Buffer> {
  const { frames } = scanZstdFrames(buffer)
  const decoder = createZstdFrameDecoder()
  const parts: Buffer[] = []
  for (const plaintext of decoder.decode(buffer, frames)) parts.push(Buffer.from(plaintext))
  return Buffer.concat(parts)
}

describe('recoverLog', () => {
  it('re-encodes a clean log unchanged in event content', async () => {
    const { ctx, root } = await mount()
    const header = meta('clean')
    await ctx.sessionPersistence.create(header)
    await ctx.sessionPersistence.append(header.id, oneTurnLog())
    const buffer = await readFile(logPath(root, header.cwd, header.id, 'zstd'))

    const result = await recoverLog(buffer)
    expect(result.droppedBytes).toBe(0)
    expect(result.issue).toBeUndefined()
    expect(result.events).toBe(oneTurnLog().length)
    expect(scanLog(await decodeCompleteFrames(result.recovered)).events).toEqual(oneTurnLog())
    await ctx.fiber.dispose()
  })

  it('salvages the valid prefix when a complete frame holds a torn record', async () => {
    const { ctx, root } = await mount()
    const header = meta('torn-record')
    await ctx.sessionPersistence.create(header)
    await ctx.sessionPersistence.append(header.id, oneTurnLog())
    const path = logPath(root, header.cwd, header.id, 'zstd')
    // A complete frame whose single record has no trailing newline: a torn row.
    await appendFile(path, await compressZstdFrame('{"type":"turn/start"'))

    const result = await recoverLog(await readFile(path))
    expect(result.droppedBytes).toBeGreaterThan(0)
    expect(result.events).toBe(oneTurnLog().length)
    const recovered = scanLog(await decodeCompleteFrames(result.recovered))
    expect(recovered.events).toEqual(oneTurnLog())
    expect(scanZstdFrames(result.recovered).tornStart).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('catches the scanner throw on a seq gap ending in turn/end', async () => {
    const { ctx, root } = await mount()
    const header = meta('seq-gap')
    await ctx.sessionPersistence.create(header)
    await ctx.sessionPersistence.append(header.id, oneTurnLog())
    const path = logPath(root, header.cwd, header.id, 'zstd')
    // A record whose seq is far past the committed length AND carries a turn/end
    // makes the scanner throw; recovery must catch it and keep the good prefix.
    const gap = [{ type: 'turn/end', seq: 999, time: 9, data: { turn: 9, reason: { kind: 'completed' } } }] as SessionEvent[]
    await appendFile(path, await compressZstdFrame(gap.map(e => JSON.stringify(e)).join('\n') + '\n'))

    const result = await recoverLog(await readFile(path))
    expect(result.issue).toMatch(/seq gap/)
    expect(result.droppedBytes).toBeGreaterThan(0)
    expect(result.events).toBe(oneTurnLog().length)
    expect(scanLog(await decodeCompleteFrames(result.recovered)).events).toEqual(oneTurnLog())
    await ctx.fiber.dispose()
  })

  it('recovers a header-only prefix when the first record is torn', async () => {
    const { ctx, root } = await mount()
    const header = meta('header-only')
    await ctx.sessionPersistence.create(header)
    await ctx.sessionPersistence.append(header.id, oneTurnLog())
    // Reuse a real header line, then a torn first record so nothing commits past it.
    const materialized = await decodeCompleteFrames(await readFile(logPath(root, header.cwd, header.id, 'zstd')))
    const headerLine = materialized.subarray(0, materialized.indexOf(0x0A) + 1)
    const buffer = Buffer.concat([
      await compressZstdFrame(headerLine),
      await compressZstdFrame('{"type":"turn/start"'),
    ])

    const result = await recoverLog(buffer)
    expect(result.events).toBe(0)
    expect(scanLog(await decodeCompleteFrames(result.recovered)).events).toEqual([])
    await ctx.fiber.dispose()
  })

  it('rejects a buffer with no Zstandard frames', async () => {
    await expect(recoverLog(Buffer.alloc(0))).rejects.toThrow(/empty or header-less/)
  })

  it('rejects a frame whose plaintext has no header newline', async () => {
    const frame = await compressZstdFrame('no-header-and-no-newline')
    await expect(recoverLog(frame)).rejects.toThrow(/empty or header-less session log/)
  })
})
