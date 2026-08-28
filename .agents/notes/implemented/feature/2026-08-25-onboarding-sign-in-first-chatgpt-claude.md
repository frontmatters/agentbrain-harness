# Agent Note: sign-in-first model connection across onboarding and the Models page

Status: implemented

## Problem

First-run onboarding presented three coequal paths at once: a local-runtime start, a single "Connect ChatGPT" OAuth row, and an always-visible API-key editor, each in its own section with its own divider. The result read as a wall of forms rather than a decision, and it exposed only one account login even though pi-ai ships OAuth flows for several providers. The Models settings page had the matching problem: it mixed a cryptically named "Default provider" API-key row with ungrouped connect rows, so the two surfaces disagreed on how connecting a model works.

## Decision

Both surfaces lead with account sign-in and group the rest.

Onboarding renders one button per entry in `OAUTH_PROVIDERS` — ChatGPT as a full-width primary, the rest two-up in a grid — each carrying the provider's brand mark. A labelled divider ("or connect another way") separates them from two collapsed rows: "Use an API key" and, when the local-runtime probe answers, "Run a local model" with a "Detected" badge. A row expands in place (the API-key row into the shared `ProviderEditor`, the local row into the model picker plus Start); only one is expanded at a time and cancelling collapses rather than ending onboarding.

The Models settings page renders the same `OAUTH_PROVIDERS` under an "Account sign-in" heading, the API-key routes and "Add provider" under "API key providers", and the local runtime under "Local". The groups are ordered with CSS `order` on the existing flex section, so the source keeps its shape while the page matches the onboarding order. The shipped placeholder route's `displayName` changes from "Default provider" to "Custom (OpenAI-compatible)" so its API-key nature is legible.

`OAUTH_PROVIDERS` is a typed `OAuthProviderChoice[]` carrying, per provider, a short name, a Models-page connect label, an onboarding button label, and a brand-logo id. It lists all seven pi-ai OAuth providers — ChatGPT (`openai-codex`), Claude (`anthropic`), Grok (`xai`), Kimi (`kimi-coding`), Copilot (`github-copilot`), OpenRouter, and Radius — because `registerPiAiFlows` already registers a flow for each id in the pi-ai builtin catalog and the apiproxy `loginService` resolves the provider generically by credential-record key, so adding a provider is data, not host wiring. `BrandMarks.tsx` (`ProviderMark` switching on the logo id) draws OpenAI, Anthropic, and xAI as their own inline logomarks; Kimi, Copilot, OpenRouter, and Radius render a lettered monogram tile until an official logomark is inlined.

## Alternatives considered

**Keep the three coequal sections, just restyle.** Rejected: the problem was hierarchy, not paint. Coequal sections cannot say "signing in is the fast path" and scale badly as more OAuth providers appear.

**Card grid / segmented tabs / two-column split for onboarding.** Prototyped as rendered mockups. The card grid and two-column layouts read busiest and buried the recommended action; segmented tabs hid two of three paths behind a click. Sign-in-first with collapsed rows kept one clear primary action while leaving the other paths one glance and one click away.

**Expose only ChatGPT + Claude.** Shipped first, then widened to all seven at the owner's request: the provider list is data, and there was no reason to withhold the logins pi-ai already supports. The grid layout absorbs the count.

**Reorder the Models page by moving its JSX.** Rejected in favour of CSS `order` on the already-flex section: moving the sixty-line row blocks risked the editor and add-provider wiring, while `order` reorders the render with a class per group.

**Per-provider onboarding button copy vs reusing the Models-page label.** Kept both: `labelKey` ("Connect ChatGPT") reads as a row action on the Models page, `onboardingLabelKey` ("Continue with ChatGPT" / "Sign in with …") reads as a first-run call to action. The grid cells show the short `nameKey` with the onboarding label as their accessible name.

## Consequences

Both surfaces show all seven account logins from one `OAUTH_PROVIDERS` list, so they cannot drift apart. Renaming the placeholder route changes web e2e transcripts and their `apps/web/tests/snapshots` fixtures that pinned "Default provider"; those web snapshots (already parked for an English/replay refresh) are re-recorded there, not in the unit gate. The unit suites mock their own provider display names, so they stay green. The account paths are wired and unit-tested with a mocked oauth face, but only ChatGPT and the local start are exercised end-to-end; the other six OAuth flows run the same generic host relay, so the risk is confined to each vendor flow, not the shared machinery. Kimi, Copilot, OpenRouter, and Radius show monogram tiles until their official logomarks are inlined in `BrandMarks`.

A device-code grant (GitHub Copilot) is the flow that exposed the end-to-end gap above: `oauth.begin` returns `{ authUrl, code }` and the Models page rendered the user code, but the onboarding dialog passed no `onAuthUrl` handler and dropped it, so the browser opened `github.com/login/device` with no code to type. Onboarding now stores the begin notice per provider and, while connecting, shows the user code and verification page beneath the button. Authorization-code providers (no code) are unaffected: the browser opens and nothing extra renders.

Two follow-ups made the device flow actually complete. First, the connect poll gave up after ~2 minutes; a device grant has the user leave for the browser to enter the code and clear 2FA, which routinely passes that, so the flow failed while still valid. `runOAuthConnect` now polls for the device code's lifetime through `OAUTH_POLL_INTERVAL_MS` / `OAUTH_POLL_MAX_ATTEMPTS`. Second, pi-ai's `device_code` event carries `expiresInSeconds`, which the relay dropped; it now threads through `AuthorizationNotice`, the apiproxy `OAuthAuthInteraction`, the `oauth.begin` view and schema, and `beginConnect`, so the poll window matches the provider's real lifetime and onboarding shows a "valid for about N min" line. Why device flow is not push-instant like ChatGPT/Claude: pi-ai's Copilot login is device-only (a public VS Code client id with the device grant); there is no browser-redirect variant, so ABH must poll GitHub's token endpoint at GitHub's interval rather than catch a loopback redirect. A server restart mid-flow kills that server-side polling, so an interrupted attempt never lands its credential.

## Related

- [local runtime row in Models](2026-08-24-local-runtime-row-in-models.md) — the keyless local path both surfaces offer.
- [shared modal product onboarding](2026-08-13-shared-modal-product-onboarding.md) — the modal chrome and step lifecycle onboarding plugs into.
- [DeepSeek onboarding credential setup](2026-07-30-deepseek-onboarding-credential-setup.md) — the earlier API-key-only first run this supersedes for the credential path.
