# Agent Note: the api-proxy resolves the OAuth seams at call time

Status: implemented

## Problem

Every account sign-in failed with a generic "Couldn't connect": `oauth.begin` returned "oauth service is absent" for all seven providers. The api-proxy built its OAuth login face at construction time from `ctx.get('authorization')` and `ctx.get('credentials')`, but in the Web composition the api-proxy (web-app bundle) mounts before those seams (base bundle). At the api-proxy's apply time both reads returned undefined, so the login face was never built and the wire reported the seam absent. API-key credentials worked because that path reads the credentials seam later, once it is mounted.

## Decision

`createOAuthLoginService(ctx)` is always constructed and resolves both seams at call time. A shared `seam(providerId)` helper reads `ctx.get('authorization')` and `ctx.get('credentials')` on each `begin`/`status`/`logout`, returning undefined when either is missing. By the time a user clicks Connect the whole composition has applied and both seams are present, so the lookup succeeds; when they are genuinely absent, `begin` rejects with an actionable error and `status`/`logout` treat the provider as not connected. The function is exported and unit-tested directly against a fake context that supplies, withholds, or partially supplies the seams.

## Alternatives considered

**Reorder the bundles so the seams mount before the api-proxy.** Rejected as fragile: the api-proxy lives in the web-app bundle and the seams in base, and cross-bundle apply order is not a guarantee callers should depend on. Call-time resolution is order-independent, which is why the seam reads use `ctx.get` (the topology-tolerant accessor) rather than a declared injection in the first place.

**Register the login face through `ctx.inject(['authorization','credentials'])`.** Rejected: `inject` re-runs on seam churn and would rebuild the face; a plain call-time read is simpler and matches how `status` polling already re-reads the store.

## Consequences

Sign-in now reaches the provider flow instead of failing immediately, on both the onboarding dialog and the Models page. The api-proxy always provides a login face, so the wire's own "loginService undefined" branch now only applies to a deployment that constructs `createApiProxy` without one (still covered by its test). The end-to-end browser flow per vendor is unchanged and still needs its own dogfood; this fix only restores the seam the flow runs through.

## Related

- [sign-in-first model connection across onboarding and the Models page](../feature/2026-08-25-onboarding-sign-in-first-chatgpt-claude.md) — the surfaces whose sign-in this unblocks.
