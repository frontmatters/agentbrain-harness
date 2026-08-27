# Agent Note: First-class AgentBrain integration

Status: implemented

## Problem

ABH must expose AgentBrain skills, context, memory, and commands without coupling its agent-agnostic runtime or agent loop to one brain implementation.

## Decision

ABH mounts AgentBrain adapters in `abh-base` while keeping the runtime, skill registry, command registry, and agent loop agent-agnostic. The adapters activate from an AgentBrain checkout and can be disabled or replaced through normal Cordis profile patches.

The filesystem skill provider discovers `<agentBrainHome>/local/skills` before system and user defaults, and `<agentBrainHome>/system/skills` as shared baseline instructions. `AGENTBRAIN_DIR` selects the checkout directly; `AGENTBRAIN_HOME` selects its install parent and resolves `<AGENTBRAIN_HOME>/agentBrain`, followed by `~/agentBrain` and the legacy developer path. Missing roots are empty and do not change startup behavior.

The AgentBrain memory plugin uses canonical `<agentBrainHome>/local/memories` when the local vault exists, derives UUID5 IDs from `brain.json`, honors the canonical incognito flag, and falls back to `<cwd>/.agentbrain/memories` otherwise. Its tools remain ordinary ABH tool registrations, while the fixed-path host writer avoids turning the general sandboxed filesystem tool into an external-vault write channel.

The AgentBrain command bridge reads effective `user-invocable` skills from `ctx.skills` and registers their metadata in the ABH command palette. Selecting a palette entry queues the original slash line as a normal user message; `tool-skill` remains the single loader and executor path. Skill changes refresh registrations, and a skill file's presence does not imply arbitrary command execution.

`agentbrain-context` projects canonical rules, shared guidance, the skills index, lifecycle guidance, preference notes, startup context, and Git-root/workspace-matching project notes once per session as a durable source-attributed message. AgentBrain-specific typed memory frontmatter is read for existing notes; semantic retrieval, skill argument-hint propagation, and live context refresh remain separate follow-up work.

## Alternatives considered

**Agent-specific loop changes:** rejected because AgentBrain behavior belongs in adapters and ordinary plugin contributions, not in the shared agent loop.

**A singular local memory path:** rejected because AgentBrain's canonical storage is `local/memories`, and a compatibility path would hide configuration errors and diverge from native AgentBrain behavior.

**Preset-owned command bridge rows:** rejected because the bridge is mounted in the host composition and must not be activated a second time by each agent preset.

## Consequences

The ABH core remains usable without AgentBrain, while an installed AgentBrain checkout supplies shared skills, context, memory, and command-palette entries. The published runtime must include the adapters and their workspace dependency closure. Semantic retrieval, argument hints, and live context refresh remain explicit future work rather than implicit behavior.

## Verification

Memory tests, integration-package typechecks, GUI tests, composition gates, runtime-closure checks, package-invariant checks, license checks, and the packed install rehearsal pass. The Web replay lane remains required before release.
