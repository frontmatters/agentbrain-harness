/**
 * Standalone recovery for a corrupt JSONL session log. The loader rejects a log
 * whose complete frames hold an incomplete or seq-broken record, because that is
 * genuine corruption rather than a recoverable torn final frame. This module
 * salvages the contiguous valid prefix a scanner commits and re-encodes it as a
 * clean log, so a session survives up to its last good entry instead of becoming
 * unreadable.
 *
 * @module @agentbrain-harness/session-persistence-jsonl/recover
 */

import { SessionLogScanner } from './format.ts'
import { compressZstdFrame, createZstdFrameDecoder, scanZstdFrames } from './zstd.ts'

/** The outcome of recovering one log buffer. */
export interface LogRecovery {
  /** The re-encoded log: one header frame followed by one event-rows frame. */
  recovered: Buffer
  /** Committed events retained from the valid prefix. */
  events: number
  /** Decompressed bytes discarded after the last good record (0 when the log was clean). */
  droppedBytes: number
  /** The scanner's stop reason when corruption was found; absent when the log was already clean. */
  issue?: string
}

/**
 * Recover the valid prefix of a session-log file and re-encode it as a clean
 * Zstandard log. Decodes every complete frame, lets the scanner commit the
 * contiguous valid record prefix (tolerating the throw it raises when a
 * `turn/end` follows the break), truncates to that boundary, and re-frames.
 * @param buffer - the raw `.jsonl.zstd` file bytes.
 * @returns the re-encoded log with the retained-event and dropped-byte counts.
 */
export async function recoverLog(buffer: Buffer): Promise<LogRecovery> {
  const { frames } = scanZstdFrames(buffer)
  if (frames.length === 0) throw new Error('empty or header-less Zstandard session log')
  const decoder = createZstdFrameDecoder()
  const parts: Buffer[] = []
  for (const plaintext of decoder.decode(buffer, frames)) parts.push(Buffer.from(plaintext))
  const full = Buffer.concat(parts)

  const headerEnd = full.indexOf(0x0A)
  if (headerEnd === -1) throw new Error('empty or header-less session log')
  const scanner = new SessionLogScanner(full.subarray(0, headerEnd + 1))
  let issue: string | undefined
  try {
    scanner.write(full.subarray(headerEnd + 1))
  } catch (error) {
    // A seq gap or unparsable row followed by a turn/end throws, but the scanner
    // has already stopped committing at the last good record; recover from there.
    issue = String(error)
  }
  const { committedBytes, eventCount } = scanner.checkpoint()
  const valid = full.subarray(0, committedBytes)

  const firstNewline = valid.indexOf(0x0A)
  const headerFrame = await compressZstdFrame(valid.subarray(0, firstNewline + 1))
  const eventBytes = valid.subarray(firstNewline + 1)
  const recovered = eventBytes.byteLength > 0
    ? Buffer.concat([headerFrame, await compressZstdFrame(eventBytes)])
    : headerFrame

  return {
    recovered,
    events: eventCount,
    droppedBytes: full.byteLength - committedBytes,
    ...issue === undefined ? {} : { issue },
  }
}
