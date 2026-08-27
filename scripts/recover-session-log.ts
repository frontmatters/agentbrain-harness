/**
 * Repair a corrupt JSONL session log by truncating it to its last good entry.
 *
 * The loader rejects a log whose complete frames hold an incomplete or
 * seq-broken record. This tool salvages the contiguous valid prefix and
 * re-encodes it as a clean log, backing up the original first.
 *
 * Usage:
 *   tsx scripts/recover-session-log.ts <path/to/session.jsonl.zstd> [--write]
 *
 * Without `--write` it reports what recovery would keep and drop (dry run).
 */
import { readFile, writeFile, rename, chmod } from 'node:fs/promises'
import { recoverLog } from '../packages/session/session-persistence-jsonl/src/recover.ts'

async function main(): Promise<void> {
  const path = process.argv[2]
  const write = process.argv.includes('--write')
  if (path === undefined) {
    console.error('usage: tsx scripts/recover-session-log.ts <session.jsonl.zstd> [--write]')
    process.exitCode = 1
    return
  }

  const result = await recoverLog(await readFile(path))
  const summary = `events=${result.events} droppedBytes=${result.droppedBytes}`
    + (result.issue === undefined ? '' : ` issue="${result.issue}"`)
  if (result.droppedBytes === 0 && result.issue === undefined) {
    console.log(`clean: ${summary} — nothing to recover`)
    return
  }

  if (!write) {
    console.log(`corrupt: ${summary}`)
    console.log('DRY RUN — pass --write to truncate to the last good entry (the original is backed up first)')
    return
  }

  const backup = `${path}.corrupt-backup`
  await rename(path, backup)
  await writeFile(path, result.recovered)
  await chmod(path, 0o600)
  console.log(`recovered: ${summary}`)
  console.log(`wrote ${result.recovered.byteLength} bytes; original backed up to ${backup}`)
}

await main()
