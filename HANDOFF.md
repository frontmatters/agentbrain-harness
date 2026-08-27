# agentBrain Harness — handover

This repository keeps an agent-agnostic ABH core and treats AgentBrain as a first-class optional integration. Read this file before continuing the integration work.

## Current integration

- `skill-filesystem` discovers AgentBrain skills from the root resolved by the canonical AgentBrain environment contract: `$AGENTBRAIN_DIR`, then `$AGENTBRAIN_HOME/agentBrain`, then `~/agentBrain`, with `~/Developer/agentBrain` as fallback. It scans `system/skills` and `local/skills`; local skills rank above system skills; missing roots are empty.
- `agentbrain-memory` is mounted by the base bundle. It uses canonical `<AgentBrain>/local/memories` and the namespace from `<AgentBrain>/brain.json`; it falls back to `<cwd>/.agentbrain/memories` otherwise. It provides `memory_save`, `memory_recall`, and `memory_forget`; writes use a fixed host-owned memory path and honor the canonical incognito flag.
- `agentbrain-context` is mounted by the base bundle. It injects canonical rules, shared guidance, skills index, lifecycle guidance, preferences, startup context, and matching project notes once per session with explicit byte limits.
- `agentbrain-commands` bridges `user-invocable` AgentBrain skills from `system/skills` and `local/skills` into the ABH command palette. It queues the original slash line so `tool-skill` remains the single skill execution path.
- `AGENTBRAIN_DIR` is the explicit AgentBrain checkout selector; `AGENTBRAIN_HOME` is its install/config parent and resolves to `<AGENTBRAIN_HOME>/agentBrain`. Profile patches can disable or replace the adapters.

## Remaining work

1. Add installer/uninstaller pointer management for detected agent configurations, with an exact reversible marker.
2. Verify Web and headless snapshots for the assembled AgentBrain integration; the keyless snapshot lane currently has unrelated ambient skill-catalog drift.
3. Complete the maintainer release sequence in [`docs/release-checklist.md`](docs/release-checklist.md); this handover keeps only the current AgentBrain integration gaps.

## Important repository facts

- The historical handover was added in commit `3d0ebaab15`; this file restores it as a maintained current-state handover.
- Do not delete ambient `css-modules.d.ts` files. The old handover recorded that mistake and its build impact.
- `dist/` may be untracked generated output; do not include it unless the release process explicitly requires it.
