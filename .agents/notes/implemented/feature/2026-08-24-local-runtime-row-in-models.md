# Agent Note: Adopt a detected local runtime from the Models provider list

Status: implemented

## Problem

A keyless local runtime (Ollama) is offered only during first-run onboarding and shown live in the Models default-model control, but it is not surfaceable from the Models provider list. A user who skipped the local onboarding path, or started one, had no in-list way to adopt the running local runtime as a provider; the base bundle deliberately ships no localhost route (a config-shipped route would falsely report first-run readiness even with no runtime installed).

## Decision

`ModelsSection` probes the local runtime on mount (`probeLocalRuntime`, credential-free, by URL) and, when one answers and no `local` route is configured yet, renders a "Local runtime detected" row with an "Add local runtime" action. Adopting it writes the keyless `local` pi-ai route (`writeLocalRoute`, the same helper the onboarding uses) with the whole detected model catalog, not just the first model, and reloads; the detection row then gives way to an ordinary "Local (Ollama)" provider row carrying every detected model. The row is detection-driven, so it appears only while a runtime is actually running, preserving the "no false readiness" stance.

## Alternatives considered

- **Always-visible "Local runtime" row with a "start Ollama" hint.** Rejected for now: it advertises a provider that is not there, the exact false-readiness posture the base bundle avoids. Detection-driven keeps the row honest.
- **Config-ship a localhost route.** Rejected: an always-registered keyless route reports active, so first-run readiness would claim the user is ready with no runtime installed.

## Consequences

- Ollama is adoptable from the Models settings list, not only onboarding.
- `models-settings.e2e.ts` blocks the localhost:11434 probe (body-filtered on the request, so the Fetch-available-models flow still reaches its mock), keeping the row deterministic regardless of whether the host runs Ollama.

## Verification

- Manual: with Ollama running, the row renders; "Add local runtime" writes the route and the row becomes a configured "Local (Ollama)" provider (screenshotted).
- `models-settings.e2e.ts` green under keyless replay; onboarding tests unaffected (they already block the probe).
