# Agent Note: single-instance guard for abh web

Status: implemented

## Problem

Repeat `abh web` starts stacked independent servers. Because the web bundle disables browser HMR, an open tab never reloads, and a forgotten older instance keeps serving a stale bundle from a different port. This produced a real, confusing failure: a day-old instance on the default port 3080 served pre-fix code and reported "No skills are available", while the current instance on another port served the correct 77 skills. Nothing warned that a second server was already running.

## Decision

`abh web` now reconciles against any already-running instance before it binds. A running web server records its pid and port in a lock at `$ABH_HOME/web.lock`; the next `abh web` reads that lock and, when the recorded process is still alive, offers to stop it and start here (the default on Enter) or, if the operator declines, starts on the next free port and prints that URL. With no terminal to answer (CI, cron, a pipe) it never kills silently: it picks a free port and warns. A stale lock whose pid is dead is dropped on read. The logic lives in `apps/cli/src/web-instance-lock.ts` behind an injected side-effect interface (`WebLockDeps`) so every branch is unit-testable without real processes or sockets; `bin.ts` wires it for the web surface only and clears the lock on process exit.

## Alternatives considered

**Detect only a port already in use (EADDRINUSE).** Rejected: it catches a second start on the same port but misses the actual failure, where the two instances bind different ports and neither conflicts.

**Scan the process table for sibling `abh web` processes.** Rejected: parsing `ps` output is fragile and not portable to Windows, where the CLI also runs.

**Track every instance in a registry rather than one lock.** Rejected as over-engineered: a single lock covers the common "I forgot one was running" case, and the dead-pid check is the safety net when a lock is left behind. Keeping two instances alive is a deliberate operator choice, made explicit by the free-port path.

## Consequences

The guard writes the lock before the app boots and creates the Harness home, so on a first-ever run `$ABH_HOME` does not exist yet; `realWebLockDeps().writeFile` therefore `mkdirSync`s the lock's parent directory before writing, otherwise the lock write threw `ENOENT` and crashed every fresh start. Lock cleanup is best-effort through `process.once('exit')`; a `SIGKILL` leaves the file, but the next start reads the dead pid and drops it, so the guard is self-healing. The guard never terminates another process without an interactive confirmation, so CI and scripted runs stay safe. It applies only to `abh web`; other surfaces are unaffected. The module sits in `apps/cli/src`, outside the per-file coverage gate, but carries unit tests for every branch.

## Verification

Unit tests cover `parseWebPort`, `withWebPort`, `readRunningInstance` (missing, malformed, dead-pid, live), `clearInstanceLock` (ours vs another's), and `ensureSingleWebInstance` (nothing running, TTY stop, TTY decline to a free port, non-TTY to a free port). End to end: instance A wrote `{ pid, port: 5210 }`; a second start requesting 5210 with no terminal detected A, printed "abh web already running (PID …, http://localhost:5210); starting on http://localhost:5211 instead", started on 5211, and left A serving.
