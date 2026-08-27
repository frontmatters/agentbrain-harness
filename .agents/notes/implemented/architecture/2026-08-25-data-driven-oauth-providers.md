# Agent Note: data-driven OAuth providers, no vendor names in code

Status: implemented

## Problem

The client hardcodes the account-login providers: `connect-provider.ts` pins seven vendor ids in `OAUTH_PROVIDERS`, `locales.ts` carries per-vendor strings, and `BrandMarks.tsx` switches per-vendor for logos. That is vendor lock-in in harness code, which the product goal forbids. The owner's rule is absolute: the harness code contains no vendor name anywhere; every vendor-specific value comes from the engine catalog surfaced by the host, or from user config.

## Decision

The provider list is driven from data. The host surfaces the oauth-capable providers it already registers; the client renders them dynamically; display names and logos come from a data overlay that the user can override (option C). No vendor name lives in a `.ts` file.

The sequence is host-first, confirmed by peer review:

1. Host `oauth.providers()` returns the oauth-capable providers as `[{id, name}]`, filtered from `authorization.list()`. See `packages/host/apiproxy/src/index.ts` (`createOAuthLoginService`), the wire in `packages/host/apiproxy/src/api/oauth.ts`, and coverage in `tests/oauth-login-service.spec.ts` + `tests/client-handler.spec.ts`.
2. The client fetches that list and renders it with loading and empty states. `fetchOAuthProviders` in `packages/client/ui-settings-models/src/client/connect-provider.ts` returns an empty list on any transport failure so the surface degrades to the API-key and local paths; both `ModelsSection.tsx` and `ProviderOnboardingDialog.tsx` load it in an effect.
3. A data overlay (settings namespace `ui-provider-overlay`) maps `id` to `{displayName, logo, order, hidden}`, merged field by field with catalog order as the fallback. `readProviderOverlay` and `applyProviderOverlay` in the client implement the read-side merge. The `@agentbrain-harness/provider-overlay` plugin (`packages/core/provider-overlay`) seeds the namespace: it registers the section with a `base` layer from its config, so `settings.describe()` surfaces the defaults before the user edits anything. The bundle patch supplies the flagship data (ChatGPT, Claude, Grok with their brand marks and order 1/2/3); no vendor name lives in the plugin's `.ts`. The settings layer deep-merges the user's section over the base per provider id, so renaming one provider keeps its shipped logo and order.
4. `OAUTH_PROVIDERS`, the per-vendor locale keys, and the `ProviderMark` per-vendor switch are gone. Labels are templates (`connectProvider` = "Connect {name}"). `BrandMarks.tsx` keeps the three real logomarks (OpenAI, Anthropic, xAI) as overlay-referenced assets; every other provider gets an auto-monogram from the display name.

The dead `cancelled` flag in `runOAuthConnect` was removed: nothing set it, so its guard branches were uncoverable. No caller passed a cancel handle, so removing it changed no behavior.

Two facts were verified against the vendored pi-ai and drive the design. First, `authorization.list()` is a superset: `registerPiAiFlows` registers a flow for every builtin provider that offers any login (oauth or api-key), so the host must filter to oauth-capable flows or the UI shows non-connectable rows that throw `UNKNOWN_METHOD` on click. Second, `provider.name` is the engine name ("OpenAI Codex", "Anthropic", "xAI"), not the marketing name, so the rename overlay is mandatory, not polish.

## Alternatives considered

**Option A, read-only catalog with no overlay.** Rejected as the shipped default: it would render "OpenAI Codex" and "xAI" instead of "ChatGPT" and "Grok", a visible regression on the flagship providers. A is the acceptable smaller first step only if the overlay is deferred deliberately.

**Option B, user config only.** Rejected: first run shows nothing until the user hand-adds a provider id and endpoint, which is a dead-end onboarding.

**Fix the bundle mount order instead of filtering.** Not applicable to the provider list; it was the fix for the separate seam-resolution bug. The list filter is required regardless.

**Bundle brand SVGs in code.** Rejected: it reintroduces the vendor names and art the rule forbids. Logos live in the overlay as data.

## Consequences

The harness source contains no vendor name in a `.ts` file. The provider list reads from `oauth.providers()`, filtered to oauth-capable. Labels use a template plus the overlay display name. Onboarding and the Models page both render the fetched list with loading and empty states, and preserve their two distinct write paths (the Models page connects a route; onboarding connects and sets the active model).

The client render paths are now async, which adds loading and empty states the previous synchronous constant did not have. The oauth wire wrappers and the poll loop in `connect-provider.ts` carry unit tests; the fetch bridge round-trips all four oauth methods (`providers`, `status`, `begin`, `logout`) in `packages/host/apiproxy/tests/client-handler.spec.ts`; the Models connect, connect-error, and disconnect-error paths carry component tests. Per-file coverage is 100%.

## Deferred

One item from the plan remains open. The REAL-composition Loader test that guards the oauth seam against a mount-order regression is not written; the seam is covered by unit and fetch-bridge round-trip tests only. The `@agentbrain-harness/provider-overlay` plugin carries its own real-provider settings test, so the flagship defaults are guarded.

## Risks

The client render paths become async, which adds states the current synchronous constant does not have. Monogram collisions (ChatGPT, Claude, and Copilot all start with C) mean auto-monogram is a last resort, not the primary mark. The overlay merge semantics must be deterministic and documented. The test rewrite is large: onboarding, components, and models-settings all assume the synchronous list today.

## Related

- [sign-in-first onboarding and Models page](../../implemented/feature/2026-08-25-onboarding-sign-in-first-chatgpt-claude.md) is the surface this refactor makes data-driven.
- [the api-proxy resolves the OAuth seams at call time](../../implemented/bug-fix/2026-08-25-apiproxy-oauth-lazy-seam.md) is the seam this list filter reuses.
