# Agent Note: Keep AgentBrain integration coverage assembled

Status: implemented

## Problem

AgentBrain skills, the command bridge, and shared memory can each pass isolated package tests while their Loader wiring remains broken. Hand-built contexts do not exercise YAML resolution, plugin export namespaces, or cross-session vault reuse.

## Decision

`packages/context/agentbrain-memory/tests/loader-composition.spec.ts` boots a temporary `cordis.yml` through Cordis `Loader` and `Include`, using real filesystem, skill registry/provider, command registry/bridge, tool runtime, system prompt, and memory plugins. Only the external model boundary is absent; no credentials or network are used. The suite discovers a real AgentBrain `SKILL.md`, asserts its command-palette descriptor, saves through one independently loaded context, disposes it, and recalls through a second context from the canonical `local/memories` directory.

## Alternatives considered

**Keep hand-built Context tests only.** They do not exercise Loader resolution, plugin namespaces, or the process composition that users run.

**Use the provider-gated context e2e.** It requires credentials and covers one LLM adapter, so it cannot provide a deterministic release gate for the AgentBrain integration.

## Consequences

Loader composition regressions and shared-vault path mistakes fail keylessly in the focused unit lane. Temporary roots and plugin fibers are owned by each test and removed during teardown; the fixture uses native path and URL APIs for macOS/Linux portability.

## Verification

Run `pnpm exec vitest run packages/context/agentbrain-memory/tests/loader-composition.spec.ts` from the repository root.
