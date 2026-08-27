# Agent Note: single-writer lock for session logs

Status: proposed

## Problem

Nothing stops concurrent writes to one session log. Mid-file corruption (a complete frame holding a torn or seq-broken record) comes from two writers appending to the same `session.jsonl.zstd` at once, or a write racing an interrupted one. Two `abh web` instances on one profile is the realistic trigger; it is a misconfiguration, but the harness allows it. The in-process coordinator already serializes writes within one process (`SessionWriteBehind`, the prepared-source exclusive reservation in `preparations.ts`), but that guarantee does not cross processes.

## Proposal

Add a cross-process advisory lock, acquired when a session first becomes live for writing and released on teardown:

- **Where.** The coordinator's live-session lifecycle in `packages/session/session-persistence/src/coordinator.ts` (the `LiveSessionState` init and its disposal). The `JsonlSessionPersistence` backend holds `ctx`, so it can own the lock file beside the log.
- **Mechanism.** A lock file (`session.lock` in the session directory) created with `O_EXCL`, carrying the holder's PID. On acquire, if the file exists and its PID is alive, refuse loud (two writers on one session is a misconfiguration). If the PID is dead, take over the stale lock. Release by removing the file on clean teardown; a crash leaves a stale file that the next start reclaims.
- **Granularity.** Per session log is precise (two processes may safely write different sessions). A per-profile lock (one `abh web` per profile) is simpler and prevents the whole class at once.

## Alternatives considered

**Rely on the loader self-heal alone.** The loader now recovers mid-file corruption on load and `recover-session-log` repairs out of band, so the pain is already mitigated. This is why the lock is deferred, not built. It is not a full substitute: self-heal still drops the corrupt tail, while a lock prevents the loss.

**Per-profile lock instead of per-session.** Simpler (one `abh web` per profile refuses a second) and prevents the whole class, but coarser: it forbids two servers on one profile even when they would touch different sessions. Prefer it only if the product never supports multiple servers per profile.

## Acceptance criteria

A second live writer of the same session (or, for the profile-lock variant, a second `abh web` on the same profile) is refused with a clear error, not silent interleaving. A stale lock whose PID is dead is reclaimed on the next start. The lock releases on clean teardown, and a crash-left stale lock does not block a restart. A REAL-composition test boots two coordinators over one root and asserts the second write path is refused; an HMR-safety test proves a re-mount reacquires its own lock without deadlocking.

## Risks

Cross-process file locking is platform-sensitive: `O_EXCL` lock files need explicit stale-PID reclamation (no OS auto-release), and PID reuse can make a dead holder look alive. HMR re-mount must not deadlock on a lock the previous fiber still holds during teardown. The value is limited by the self-heal already in place, so pick this up if two-writer corruption is seen in normal single-instance use, or before supporting multiple servers per profile.
