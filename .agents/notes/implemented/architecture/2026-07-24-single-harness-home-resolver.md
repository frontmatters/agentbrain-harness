# Agent Note: One harness home resolver

Status: implemented

## Problem

The harness had two inconsistent conventions for "where does agentBrain Harness user data live":

- `@agentbrain-harness/home` resolved `configured ?? $ABH_HOME ?? ~/.abh`.
- `@agentbrain-harness/home-paths` shipped a **second** `resolveDshHome` with the same precedence plus tilde expansion — a near-duplicate of `abh-home` that no gate flagged because the two lived in different packages and had already drifted (only one expanded tildes).

Two resolvers for the same cross-cutting fact meant there was no single home policy.

## Decision

One resolver owns the harness home, in `@agentbrain-harness/home-paths`, single-root:

```
explicit configured path  >  $ABH_HOME  >  ~/.abh
```

An empty or whitespace-only `$ABH_HOME` is treated as unset; otherwise `resolve('')` would silently place the home at the current working directory. The harness keeps all user data under one root; there is no XDG config/data/cache split. `abhHomePath(...segments)` joins deployment-owned children onto that root, and `abh-app-boot` exposes it to Loader `!!js` config expressions before mounting entries, so shipped compositions derive `sessions` and `storages` without copying the resolver. `abhHomeDisplay()` names a resolved root symbolically for user-facing paths — `~/.abh` for the default home, `$ABH_HOME` for any configured home — so the user-global `AGENTS.md` label never leaks an absolute machine path. It replaces agent-instructions's bespoke default-vs-`$ABH_HOME` check.

`@agentbrain-harness/home` is deleted. Its three importers (`abh-tool-bash`, `abh-skill-filesystem`, `abh-agent-spine-demo`) import `resolveDshHome` from `abh-home-paths`.

`abh-telemetry` and its separate home policy are absent under the [SDK project toolchain removal](../simplification/2026-08-11-remove-sdk-project-toolchain.md), leaving this resolver as the sole home policy.

## Alternatives considered

**Leave the two `resolveDshHome` copies in place.** They had already drifted (one expands tildes, one didn't) and encode the same cross-cutting fact twice. Consolidation is the point of the `util/` layer; a duplicate resolver is a latent divergence bug.

**Adopt XDG (honor `$XDG_CONFIG_HOME`, or split config/data/cache into separate trees).** Considered and dropped in favor of one obvious root. A single `$ABH_HOME || ~/.abh` ground truth matches `~/.claude` / `~/.aws`, needs no per-kind reclassification of every `~/.abh` consumer, and leaves no resolver asymmetry to reconcile.

## Consequences

- One home fact, one resolver. `abh-home-paths` is the sole owner; the `util/` group loses the `home` package.
