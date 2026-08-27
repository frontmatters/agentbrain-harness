# `@agentbrain-harness/agentbrain-commands`

Bridges AgentBrain `user-invocable` skills into the ABH command palette. AgentBrain stores slash commands as `SKILL.md` directories under `system/skills` and `local/skills`; it does not use a separate commands directory.

The bridge reads the effective `ctx.skills` catalog in its current Cordis scope and registers every user-invocable skill with `ctx.commands`. Selecting `/save-learning` or another entry queues the original slash line as a normal user message. ABH's existing `tool-skill` pre-step then loads the skill body, preserving one execution path, session logging, resource hints, and tool policy.

The bridge refreshes registrations after `skills/change`, so filesystem skill updates reach the palette. Mount it in the same preset scope as `skill-filesystem` when skills are scoped per agent. A missing AgentBrain checkout produces no entries; the ordinary ABH command registry remains available.

## Model Experience

### Command selection

#### What the model sees

The `ctx.commands` bridge affects human command selection only; it does not add model-facing prompt text or tools.

#### Token effect

None until the existing skill consumer handles the queued user message.

#### KV Cache effect

None; selecting a command queues a normal user message and the existing skill consumer owns any model input.

## Known Limitations and Deferred Work

- The bridge exposes skill metadata in the palette but does not execute arbitrary AgentBrain scripts directly; shell and file operations remain model-visible ABH tool calls.
