# Agent Note: add a Skills tab to the AgentBrain section, scoped to the default preset

Status: implemented

## Problem

The AgentBrain settings section showed only addons; its earlier inline skills list was removed because the host `listSkills()` read the empty host-global skill layer (the web-app bundle disables the host `skill-filesystem`, so presets own local discovery). Skills existed and were reachable from the `/` command menu through a session's preset scope, but there was no surface to see or manage them, and the user asked for skills to have their own tab under AgentBrain.

## Decision

Split the AgentBrain section into two tabs, Addons and Skills, and make the host list the real catalog. The section renders a compact in-section tab bar (`role="tablist"` with `role="tab"` buttons and an active underline) and mounts one panel at a time: `AddonsPanel` (the existing grouped addon management) or `SkillsPanel` (a list of skills with a per-skill enable/disable). The host `AgentbrainAddonsGateway.listSkills()` views the default preset's standing scope via `ctx.get('agentPresets')?.standingKeyFor()` (extracted into the private `skillScope()` helper) instead of the empty global layer, so it returns the same catalog a fresh session composes; a missing or broken preset degrades to the global layer rather than failing the read. Enable/disable stays the global skill policy (`setSkillEnabled` → `ctx.skills.setEnabled`), which the registry enforces across scopes.

Each skill row carries its routing metadata: the `provider` as a chip beside the name and, when the skill declares one, a `whenToUse` label under the description. `ManagedSkillInfo` gained `whenToUse: string | null` for this. A per-row **View** button opens a `Modal` (from `client-ui-primitives`) that renders the full `SKILL.md` body through `MarkdownText`, with the provider and frontmatter tags as chips. The body loads on demand through a new `getSkill(name)` Remote on the gateway, which reads `ctx.skills.get(name, { scope })` at the same `skillScope()` and returns a `SkillDetail` (name, description, whenToUse, provider, content, tags) or `null` when no skill owns the name; the client tolerates a stale response by keying the pending view on the requested name.

## Alternatives considered

**Extract a shared tabbed-section component and refactor the Plugins section to use it.** Deferred: the Plugins section is covered by the `plugin-config` web snapshot and its tab chrome carries roving-tabindex keyboard navigation, so reusing it means churn on a snapshotted surface. A self-contained two-tab bar in this section is smaller and does not clone `PluginsSettingsSection` (the duplication gate forbids the copy). Extraction is worth revisiting when a third tabbed section appears.

**Re-enable the host global `skill-filesystem` so the global layer populates.** Rejected for the reason recorded in the section note: a global provider would grant every agentBrain skill to every agent regardless of its preset, breaking the preset-scoped composition the web-app bundle disables it to preserve.

**Stack addons and skills on one scrolling page.** Rejected: the user asked for skills in their own tab, and two tabs keep each list scannable.

## Consequences

`host-agentbrain-addons` gains a type-only peer and dev dependency on `@agentbrain-harness/agent-presets` (plus a tsconfig reference) for the Context merge that types `ctx.get('agentPresets')`; nothing is imported at runtime and the read is optional. The Skills tab lists the default preset's catalog, so a deployment whose default preset mounts no skills shows an empty tab; that matches what its agents receive. The in-section tab bar switches on click and native focus without arrow-key roving, which is acceptable for two tabs. The client re-injects `listSkills`/`setSkillEnabled`, which the section note retained for this follow-up.

## Verification

Rebuilt the host and client libs and the web shell, restarted the server, and probed the section through the browser: the Skills tab lists 77 filesystem skills, each with a provider chip, a Disable action, and a View button; View opens the modal and renders the skill's `SKILL.md` as Markdown with its tag chips. `oxlint` and the host and client `tsc` builds pass for the changed packages, and `pnpm run doc-sync` (26 gates) and `pnpm run hygiene` are clean. The `host-agentbrain-addons` and `client-ui-settings-addons` packages were brought to per-file 100% coverage: the addon gateway's operations (`check`/`test`/`enable`/`disable`/`run`/constructor) and the new skill reads gained unit tests, and both settings panels plus the section and apply wiring gained jsdom/RTL specs, closing the coverage gap those files carried since they were added.
