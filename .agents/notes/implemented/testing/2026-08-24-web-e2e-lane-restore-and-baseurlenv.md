# Agent Note: Web e2e lane restoration and the ABH_LLM_BASE_URL endpoint knob

Status: implemented

## Problem

The `apps/web` browser e2e lane (`pnpm run test:web`, `vitest.web.config.ts`) had rotted to 60/83 files red (190 failed tests). The lane is a real CI gate (`check:ci:consumers` -> `web-snapshot`), so it blocked a clean build. The breakage was not one cause; it accumulated across refactors that changed the assembled web product without regenerating this lane:

- **Stale build.** Running the lane against an out-of-date `dist` produced ~60 `slot entry crashed` console-tripwire failures: the built `client-ui-primitives` lib predated the `NeuralLogo`/`BrandMark` exports, so the brand-mark slot occupant resolved to `undefined` and crashed on every page. A full `pnpm run build` cleared them with no code change (190 -> 103 failed).
- **Scaffold provider mismatch (the dominant real cause).** The shipped composition now routes `agent-default-model` through the vendor-neutral `llm-pi-ai` `default` route (credential `ABH_LLM_API_KEY`), but `scaffold.ts` still published the replay adapter under the legacy `deepseek-official` id and disabled `llm-deepseek`. Any fixture that drove a live turn routed to `default`, hit the real (credential-less) `llm-pi-ai` route, and failed `MISSING_CREDENTIAL` / `fixture not fully consumed` across ~14 files. This looked like fixture-drift needing a re-record; it was a two-line scaffold wiring bug.
- **Search-provider mount stale.** `scaffold.ts` mounted `web-search-deepseek` via an override-by-id patch, but the bundle removed that row (vendor-neutral default), so the vendored include loader silently skipped the non-matching patch and the search provider never mounted (`web-search-round` returned no results). A genuine test-infra regression the lane correctly surfaced.
- **Stale goldens and renamed selectors.** Recorded `*.expected.md` goldens lagged the source (model label `DeepSeek-V4-Flash` -> `gpt-5`, a few residual Simplified-Chinese labels the locale migration never regenerated) and drive-scripts referenced renamed accessible names (the provider-form submit `Save` -> `Apply`).
- **Deliberate behaviour changes asserted as old.** The favicon became a self-contained chip (no `prefers-color-scheme` switch), the hero mark became an animated `<canvas>` (`NeuralLogo`, not an SVG with a CSS animation), onboarding became generic (no default `deepseek-official` row), DeepSeek is no longer mounted by default, and the Web-search settings card is no longer shipped. Tests asserting the old behaviour failed correctly and needed updating to the shipped intent.

Separately, `smoke-real.e2e.ts` spawns the real CLI against a local mock via env, but pointed the default provider through `DEEPSEEK_BASE_URL`, which the vendor-neutral `default` route no longer reads; there was no sanctioned way to point the shipped default route at an arbitrary OpenAI-compatible endpoint (a self-hosted gateway, a local runtime), because `verify-config-source-ownership` forbids inlining an endpoint from the environment in shipped config.

## Decision

Restore the lane to green (82/83 files, 267 passing; the one skipped-set is the real-key figma smoke) and add a gate-compliant endpoint reference so the default route can target any OpenAI-compatible endpoint.

### Scaffold provider wiring (`apps/web/tests/scaffold.ts`)

Keyless replay keeps `llm-pi-ai` mounted for its installed provider catalog (the Models page configures against it) but patches its config to `providers: {}`, dropping the real credential-less `default` route so the stub replay adapter can own the `default` id without a duplicate-registration error. `REPLAY_PROVIDERS` now carries two ids: `default` / `gpt-5` (the composition default the composer resolves and live turns route to) and `deepseek-official` / `deepseek-v4-flash` (seed fixtures recorded before the vendor-neutral default still name this route, so a resumed session resolves it instead of leaving the composer disabled). `installLlmReplay` (fixture scenarios) and the `RouteOnlyAdapter` (fixture-free scenarios) both register the full catalog; a stray live call still fails loud. The `deepSeekSearch` mount became an `insert` so the removed bundle row is added rather than a skipped override-by-id.

### `ABH_LLM_BASE_URL` via a `baseURLEnv` reference

`llm-pi-ai` provider profiles gain `baseURLEnv?: string`: an endpoint reference (environment-variable name), resolved in `resolveProfiles` from `process.env`. A set, non-empty value wins over `baseURL`; empty or unset falls back to `baseURL` (or the installed catalog endpoint). Unlike a `!!js` inline this is a reference, so `verify-config-source-ownership` stays satisfied (its deny form is `/^\s*(apiKey|baseURL|apiKeyEnv|authToken|headers)\s*:\s*!!js\b/`). The base bundle sets `baseURLEnv: ABH_LLM_BASE_URL` on the shipped `default` route, so pointing the default provider at a local runtime or self-hosted gateway is configuration, not a code change. `smoke-real.e2e.ts` now drives the CLI through `ABH_LLM_API_KEY` + `ABH_LLM_BASE_URL`; its transport-retry mock also accepts `max_completion_tokens === 64` (the openai-completions field the title request uses) so the title turn is excluded from the retry count.

### Behaviour-test updates

Tests were updated to the shipped intent, not force-flipped: favicon assertion -> the self-contained chip (`#1f2126` plate, `#e8e8ea` marks, no media query); hero mark -> `<canvas>` present and `aria-hidden`; onboarding -> generic `default` provider row and `ABH_LLM_API_KEY` credential; `shipped-composition` retry-policy -> the `default` route; `plugin-config` -> the shipped card set without Web search. `onboarding-deepseek-config` stays as the generic first-run credential-setup test. Goldens regenerated under the final scaffold via `ABH_SNAPSHOT=refresh`, diff-reviewed to reject any `MISSING_CREDENTIAL` capture.

### Unrelated fix folded in

`client-ui-primitives/BrandWordmark` dropped `textLength="96"` + `lengthAdjust="spacingAndGlyphs"`, which stretched the "agentBrain" glyphs to a fixed width (visibly squashed). The wordmark now renders at natural proportions.

## Alternatives considered

- **Re-record every fixture against a provider (local or cloud).** The `MISSING_CREDENTIAL` failures read as fixture-drift, so the first plan was to re-record ~14 scenarios with a key. Rejected once the cause was found: the fixtures were fine; the scaffold published the wrong provider id. A re-record would have churned all goldens and spent a key for no behaviour change.
- **Inline the endpoint from the environment** (`baseURL: !!js process.env.ABH_LLM_BASE_URL`). Rejected: `verify-config-source-ownership` forbids the `!!js` inline form for an endpoint in shipped config. The `baseURLEnv` reference is the sanctioned parallel to `apiKeyEnv`.
- **Settings-only endpoint override, no env knob.** Viable (a `llm-pi-ai` settings section can set `baseURL`), but it gives no simple operator env var. `baseURLEnv` supports both: shipped config names the variable, the operator sets it.
- **Disable `llm-pi-ai` entirely in keyless replay.** Rejected: it removes the installed catalog the Models page configures against and leaves fixture-free scenarios with no boot-time `default` route, disabling the composer. Emptying its `providers` while keeping the row mounted preserves the catalog.

## Consequences

- The web e2e lane is a green CI gate again; broken assembled-web behaviour is caught once more.
- `ABH_LLM_BASE_URL` is a supported operator knob: the shipped default provider can target a local runtime, a self-hosted gateway, or any OpenAI-compatible endpoint without a code change.
- The scaffold serves both `default` and the legacy `deepseek-official` id. Small debt: seed fixtures still name `deepseek-official`; a future seed regeneration can drop the second catalog entry.
- Goldens now reflect the vendor-neutral shipped UI (generic default provider, no DeepSeek row, no Web-search card, canvas hero mark, self-contained favicon).

## Verification

- `pnpm run test:web`: 82/83 files, 267 tests pass keyless (replay).
- `packages/llm/llm-pi-ai` unit tests: 238 pass, including a new `baseURLEnv` resolution test (env wins / empty and unset fall back / empty `baseURLEnv` throws).
- `verify-config-source-ownership` and `verify-config-catalog` pass; `docs/config-catalog.md` regenerated for the new field; full `pnpm run typecheck` clean.
