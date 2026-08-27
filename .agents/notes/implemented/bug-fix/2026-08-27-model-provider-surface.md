# Agent Note: Keep provider settings cards inside the panel

Status: implemented

## Problem

Provider cards in Models settings allowed long authorization URLs and action rows to exceed the settings column. The local Ollama runtime also used the generic provider fallback, so it had no recognizable provider mark. OAuth post-login provisioning failures could leave a provider permanently displaying `Connecting…` because the asynchronous route setup was not observed.

## Decision

Provider card headers wrap their action rows, authorization links use anywhere-wrapping, and the local runtime renders an inline Ollama mark. OAuth route provisioning errors are caught by both the Models page and onboarding flow and move the provider to its visible error state.

## Alternatives considered

**Clip authorization URLs.** Rejected because the URL remains necessary as a fallback when popup opening is blocked.

**Use a generic monogram for Ollama.** Rejected because the local runtime is a first-class supported path and needs a stable recognizable mark.

## Consequences

Cards remain usable at the settings panel width, long OAuth links remain selectable, and provisioning failures no longer leave an unrecoverable connecting state. The OAuth provider's upstream authorization failure still remains provider-specific and is shown as the existing generic connect error.

## Verification

Run `pnpm exec vitest run packages/client/ui-settings-models/tests --coverage=false` and `pnpm --filter @agentbrain-harness/client-ui-settings-models bundle` from the repository root.
