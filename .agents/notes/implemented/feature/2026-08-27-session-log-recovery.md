# Agent Note: recover a corrupt session log to its last good entry

Status: implemented

## Problem

The JSONL loader distinguishes a recoverable torn final frame from genuine corruption: a complete Zstandard frame holding an incomplete or seq-broken record is rejected loud, so opening that session throws "corrupt Zstandard session log" and its whole history becomes unreadable. That corruption is produced by interrupted or concurrent writes to one session log (an abnormal shutdown, or two writers on one profile). The valid prefix before the break is intact, but nothing salvaged it.

## Decision

Add `recoverLog(buffer)` in `packages/session/session-persistence-jsonl/src/recover.ts`. It decodes every complete frame, lets `SessionLogScanner` commit the contiguous valid record prefix (catching the throw the scanner raises when a `turn/end` follows the break, since `committedBytes` already holds the last-good boundary), truncates to that boundary, and re-encodes the prefix as a clean two-frame log (one header frame, one event-rows frame). It reports the retained-event and dropped-byte counts and the scanner's stop reason.

`scripts/recover-session-log.ts` wraps it as a CLI: dry-run by default, and with `--write` it backs up the original to `<path>.corrupt-backup`, writes the recovered log, and restores `0o600`.

## Alternatives considered

**Re-sequence the records after the break.** Rejected: a seq gap means interleaved or duplicated writes, so the post-break records cannot be trusted to form a coherent session; the contiguous valid prefix is the only safe boundary.

**Only expose the helper, no script.** Rejected: the immediate need was repairing existing corrupt sessions on disk, which the CLI does directly.

## Consequences

A corrupt session survives up to its last good entry instead of being unreadable, with the dropped tail reported rather than silently lost. `recoverLog` stays internal to the package (imported by the script); it is not added to the public runtime export. This CLI is deliberate, out-of-band recovery. The loader now also self-heals mid-file corruption on load (see [self-heal note](../architecture/2026-08-27-session-log-self-heal.md)); preventing the corruption with a single-writer lock is the remaining follow-up.

## Verification

`pnpm exec vitest run packages/session/session-persistence-jsonl/tests/recover.spec.ts` (six cases: clean re-encode, torn record in a complete frame, seq gap ending in `turn/end`, header-only prefix, and the two empty-input rejections). Per-file coverage of `recover.ts` is 100%.
