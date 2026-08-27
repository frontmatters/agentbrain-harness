# Agent Note: Resolve client domain-layering violations by relocating shared declarations

Status: proposed

## Problem

`scripts/verify-client-domain-graph.ts` enforces intra-package layering inside `packages/client/*/src/client/`: a `contract/` file (layer 0) and a domain directory may not import a sibling domain, and only `apply.ts`/`index.ts` may assemble across domains. The gate was added by `e1777b7891` already reporting 23 violations and was never green; three more accrued on the rebrand branch, so `check:all` carried it as a red gate (26 violations). The gate is all-or-nothing, so partial cleanup does not clear it.

The violations were not accidental imports. `contract/` files pulled shape types out of the `sessions/` and `workspaces/` domains (inverting the layer), the `input/` and `queue/` domains imported each other, the top-level `service.ts` reached into `input/`, and shared UI pieces (`ReferenceIcon`, metric formatters, snapshot readers) lived inside one domain while a sibling consumed them.

## Proposal

Relocate every shared declaration to a location the gate permits both `contract/` and domains to import (`contract/` itself, or a top-level file), then import it back into its original site. Each `index.ts` barrel keeps the same exported names at their original paths, so external packages that consume the package barrel are unchanged. The moves are type-only or self-contained modules.

Concretely:

- `runtime`: hoist `scope.ts` and `notifier.ts` (single-primitive `agents/` and a domain-agnostic `Notifier`) and the self-contained `pending.ts` / `context-provenance.ts` to top-level; move the session view-model (`ConversationSnapshot` and its graph) to `contract/conversation-model.ts`; move the sessions-service face types (`SessionSummary`, `SessionListState`, `SessionListPhase`, `SubagentCatalogSnapshot`, `SessionSearchResultItem`, `SessionBinding`, `SessionProvideContribution`, `SessionProvideDescriptor`) to `contract/sessions.ts`; move `WorkspaceListState` / `WorkspaceListPhase` to `contract/workspaces.ts`.
- `ui-workspace`: flatten `rows/` into a top-level `Rows.tsx` (browser-internal presentation, not an injected domain).
- `ui-conversation`: move `input/contract.ts` wholesale to `contract/input-contract.ts` (it imported only contract siblings); extract `ComposerBlock`/`ComposerBlocks` to `contract/composer-blocks.ts`; extract the pure formatters (`formatTokens`, `formatDuration`, `cacheHitPercent`, `billedInputTokens`, `contextOccupancy`) to top-level `stats-format.ts`; hoist `ReferenceIcon.tsx`, `turn-metrics.ts`, `tool-node-reader.ts`, the queue read face, and `decorations.ts` to top-level.

## Alternatives considered

**Weaken or whitelist the gate.** Fastest to green, but the gate encodes a real layering invariant the codebase values; suppressing it would let the contract layer keep depending on domain internals. Rejected.

**Defer the runtime view-model migration to its own session and land only the cheap relocations.** The gate is all-or-nothing, so this would leave `check:all` red with no release benefit. The view-model migration is type-only and fully compiler-checked, so the risk is review surface, not runtime behavior; doing the whole sweep in atomic per-cluster commits captures the value now.

## Acceptance criteria

- `pnpm exec tsx scripts/verify-client-domain-graph.ts` prints "client domain layering clean" (0 violations).
- `pnpm run typecheck` is clean; `pnpm run verify-client-catalog` regenerated and clean.
- `runtime` (349) and `ui-conversation` (462) package tests pass; the full `test` gate passes.
- Every `index.ts` barrel keeps its previous exported names, so no external consumer edit is required.

## Risks

- The barrel keeps names stable, but a stray relative import of a moved file bypasses the barrel. Filesystem reads that name a moved path are not type-checked; the `ui-workspace` browser-styles test read `rows/Rows.module.css` by path and was updated separately. A repo-wide path scan covered the remaining cases.
- The runtime session view-model and face types now live in `contract/`, which widens what that layer owns. This is intended (contract is the shared shape layer), but future edits must keep runtime code out of those files; only types and pure helpers moved.
