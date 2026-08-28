# Agent Note: oauth.begin returns a structured error instead of a 500

Status: implemented

## Problem

Account sign-in intermittently failed with a generic "Couldn't connect" and nothing actionable in the server log. The failing providers changed between attempts (ChatGPT and GitHub Copilot failed while Claude connected and Grok showed its device code), which pointed at a flaky begin, not a broken provider. `oauth.begin` awaited `Promise.race([urlPromise, timeoutPromise])` with no surrounding try/catch: when the login flow rejected (a provider error or a device-code rate limit) or the 30s auth-url timeout fired, the rejection left the RPC method unhandled, so the transport reported HTTP 500. A 500 is not a structured `{ ok: false, error }` result, so the client's `beginConnect` saw a transport failure rather than a reason, the UI fell back to the generic error, and the only server-side trace was a `ctx.logger.warn` that the stdout log did not surface prominently.

## Decision

Wrap the race in try/catch and return `err(request, { code: 'internal', message, details: {} })` on rejection, mirroring the existing "oauth service is absent" branch that already returns a structured error. The message carries the rejection reason (the provider's error text or the timeout message), and the handler logs it through `ctx.logger.warn` before returning. The begin flow's success path is unchanged: it still resolves the auth URL (and, for a device grant, the user code) from the first `auth_url`/`device_code` event.

## Alternatives considered

**Leave begin rejecting and map rejections to errors in the RPC framework.** Rejected: the framework's generic 500 mapping loses the reason and applies to every method; the fix belongs in the one handler that has the reason in hand, next to the sibling error branch that already returns structured errors.

**Retry or back off inside begin on a rate-limited device request.** Rejected here as out of scope: the underlying flakiness is a provider rate limit on repeated device-authorization requests, not something begin should mask. Surfacing a clean, logged error lets the client and operator see "rate limited" and retry, which is the correct behavior for a transient upstream limit.

## Consequences

A begin failure is now a normal wire result the client can read, and the reason is logged. The client's visible copy is unchanged for now — `runOAuthConnect`'s `onError` still shows the generic "Couldn't connect" — but the structured error is available to surface a specific reason later, and the 500 no longer appears in the browser console. The change does not remove the upstream rate limit: hammering a device flow (many rapid Connect clicks, or automated probes sharing the same host) still trips it, and the user now sees a clean failure and can retry once it cools down. Verified by unit tests for both the timeout path and a rejecting login flow; end to end, a github-copilot begin that previously 500'd returns `{ ok: true, value: { authUrl, code } }` when not rate limited and a structured internal error when it is.

## Related

- [the api-proxy resolves the OAuth seams at call time](2026-08-25-apiproxy-oauth-lazy-seam.md) — the earlier begin fix; this hardens the same handler's failure path.
- [sign-in-first onboarding](../feature/2026-08-25-onboarding-sign-in-first-chatgpt-claude.md) — the surface whose device-code display was fixed alongside this.
