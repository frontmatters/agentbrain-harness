# Agent Note: the loader self-heals mid-file session-log corruption

Status: implemented

## Problem

The Zstandard loader threw "complete frame contains a torn JSONL record" when a complete frame held an incomplete or seq-broken record, so opening the session failed and its whole history was unreadable. That corruption comes from interrupted or concurrent writes to one log, and the valid prefix before the break stayed intact but unreachable. A recoverable torn final frame was already repaired on load, but a mid-file break was not.

## Decision

`readZstdPrefix` in `packages/session/session-persistence-jsonl/src/index.ts` now recovers the contiguous valid prefix instead of throwing: it catches the `SessionLogScanner` throw a seq-broken record ending in `turn/end` raises, and on any mid-file break (a torn record, or the scanner stopping short) it returns a torn marker that truncates the file to its header frame and re-appends the committed events through the existing `commitRepair` path. The session loads up to its last good entry and the log is rewritten clean, so a re-load stays clean.

Because this corruption should not occur with a single writer (it comes from interrupted or concurrent writes), the recovery is not silent: the backend logs a `ctx.logger.warn` naming the session, the retained-event count, and the dropped bytes. This preserves the original "surface the corruption" intent while replacing an unreadable session with a usable one.

Only the scanner's own throw is caught; a frame that fails Zstandard structural validation still throws from the decoder, because a broken frame is not a recoverable JSONL tear.

## Alternatives considered

**Keep failing loud.** Rejected for the interactive product: a corrupt session became permanently unopenable, and the manual `recover-session-log` tool was the only escape. Recovering on load with a warning keeps the signal without the dead end.

**Recover silently, like a torn tail.** Rejected: a torn final frame is an expected interrupted write, but a mid-file break signals an abnormal writer condition worth surfacing.

**A new session event for the truncation.** Deferred: the warning log is the visible signal for now; a model-visible or UI notice can build on it later.

## Consequences

A session survives mid-file corruption up to its last good entry, and the drop is reported, not silent. The rewrite reuses `commitRepair` (truncate to the header frame, re-append the committed events), so no backend interface changed. The `none` compression path already truncates torn records to `committedBytes`; its seq-gap throw is not yet recovered and remains a smaller follow-up. Preventing the corruption with a single-writer lock is the remaining item.

## Verification

`pnpm exec vitest run packages/session/session-persistence-jsonl/tests/zstd.spec.ts` covers both recovery paths (a torn record in a complete frame, and a seq-broken record ending in `turn/end`), asserts the warning and the clean re-load, and keeps the decoder's frame-validation rejection loud.
