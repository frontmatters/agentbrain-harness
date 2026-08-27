# Agent Note: web "Connect ChatGPT" account login on the host authorization seam

Status: proposed

## Problem

A first-run user of the Web surface can only reach a model by pasting an API key, yet many users have a ChatGPT (or Anthropic, xAI, Kimi) plan and no API key. The harness has a host-side sign-in capability (`ctx.authorization` flows plus the `llm-pi-ai` login flows that wrap `@earendil-works/pi-ai`), but it ships no web surface: the authorization seam is driven only from the CLI. Nothing lets a browser user start a provider login, and a connected credential does not surface the provider's models until a route names it.

## Proposal

Add a web account-login path as our own additive layer over the existing host seam, without editing the seam:

- **apiproxy `oauth` domain** (`status`/`logout`/`begin(providerId) -> {authUrl}`): the gateway's `apply` supplies an `OAuthLoginServiceFace` backed by `ctx.authorization` and `ctx.credentials`. `begin` runs the provider's authorization flow, relaying its `auth_url` notice as the returned URL and answering the method prompt (`browser`); it leaves the raced `manual_code` fallback pending until the loopback callback aborts it. `status`/`logout` read and clear the durable credential record. The provider is matched to its flow by the id segment of its credential key, so the gateway stays decoupled from any LLM adapter.
- **UI, two surfaces**: a "Connect ChatGPT" row in the Models settings section and a "Continue with ChatGPT" option atop first-run onboarding, both driving a shared `runOAuthConnect` helper (begin, open the auth URL, poll status).
- **pi-ai callback-page rebrand** (`patches/@earendil-works__pi-ai@0.82.1.patch`): pi-ai serves one shared, hard-coded callback page across every provider; a pnpm patch swaps its logo for the agentBrain mark so every provider's callback is agentBrain-branded.

Keeping pi-ai as the multi-provider engine is deliberate: the same seam and UI extend to Anthropic, xAI, and Kimi by adding rows, not per-provider loopbacks.

## Alternatives considered

**Hand-build the credential store and login orchestration in the app.** The first cut did this (a `FileCredentialStore` package and a `LoginService` package). Upstream had already built the same capability as reviewed capability seams (durable credential records, an authorization seam, sign-in in `llm-pi-ai`); those were re-derived in and the hand-built plumbing removed. Only the web wire and UI, which upstream lacks, remain ours.

**Register our own OpenAI OAuth client for agentBrain branding.** OpenAI offers no third-party client that grants model access on a user's ChatGPT plan; only its first-party Codex client does, which pi-ai reuses. So the consent screen reads "Codex", not "agentBrain" (unavoidable until OpenAI ships that). Only the callback page is ours to rebrand.

## Acceptance criteria

- `pnpm run typecheck` clean; `pnpm run hygiene` green; `pnpm run duplication` finds no clones.
- apiproxy oauth tests and the credentials/authorization package tests pass.
- The Models connect row and first-run onboarding render in light and dark (verified via the keyless web e2e scaffold).
- A live web build returns a real `auth.openai.com` authorization URL from `oauth.begin` and shows the agentBrain-branded callback page.

## Risks

- **The consent screen and OAuth client identity stay first-party.** abh reuses OpenAI's Codex client through pi-ai, a ToS gray area shared by all Codex-compatible tools. Revisit if OpenAI ships third-party plan-scoped access.
- **A connected account still needs a mounted llm route to surface its models.** Upstream's sign-in makes the provider selectable; onboarding must also set the default model to the connected provider. That UI-only step is the remaining follow-up before the flow leaves a first-run user with a usable model.
- **A live end-to-end login is dogfooded up to the human step, not through token refresh.** The refresh path is unit-covered only; a stale loopback from repeated `begin` calls binds `:1455` and makes a later callback fail with "State mismatch", so only one login should be in flight at a time.
