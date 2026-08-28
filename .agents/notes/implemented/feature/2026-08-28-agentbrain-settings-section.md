# Agent Note: promote the AgentBrain surface to its own settings section

Status: implemented

## Problem

The AgentBrain addon management lived as one tab (`settings.plugins.tab`, id `agentBrainAddons`) inside the Plugins settings section, and that tab carried a skills sub-section at its foot. Two things were wrong. First, agentBrain is a distinct product surface, not a kind of core-plugin configuration, so burying it as a Plugins tab misrepresented it in the navigation. Second, the skills sub-section called the host `listSkills()`, which reads `ctx.skills.list()` with no scope — the global skill layer — and the web-app bundle deliberately disables the host `skill-filesystem` provider (`packages/bundle/web-app/cordis.patch.yml`, "presets own local discovery"), so the global layer is empty and the sub-section always rendered "No skills available" even though the agent's `/` command menu lists the real agentBrain skills through its preset scope.

## Decision

Promote the surface to its own top-level `settings.section` (id `agentbrain`, order 18, between Plugins at 15 and Agent presets at 20). The section renders the addon management unchanged: the System-then-Local grouping and the per-group Enable all / Disable all bulk actions carry over verbatim. The always-empty inline skills sub-section is removed; the section no longer injects `listSkills`/`setSkillEnabled`. The component and its files are renamed from `AgentBrainAddonsSettingsTab` to `AgentBrainSettingsSection`, and the component now draws its own `## AgentBrain addons` heading and intro line because a section owns its chrome where a tab did not. The host `listSkills`/`setSkillEnabled` remotes on `AgentbrainAddonsGateway` are retained unused for the follow-up Skills tab.

## Alternatives considered

**Keep it a Plugins tab and only fix the skills query.** Rejected: the user asked for agentBrain to be its own navigation category, and mixing it with core plugin configuration is the misrepresentation this change corrects.

**Re-enable the host global `skill-filesystem` so `listSkills()` populates.** Rejected: the merge is by name with the nearest layer winning, so it would not duplicate entries, but a global provider would grant every agentBrain skill to every agent regardless of its preset, breaking the preset-scoped skill composition the web-app bundle disables the global provider to preserve.

**Introduce a shared tabbed-section component now (Addons + Skills tabs).** Deferred: a single-page section is idiomatic here (Models is one), and a tab structure is only justified once there are two tabs. It lands with the Skills tab, extracting shared chrome rather than cloning `PluginsSettingsSection` (the duplication gate forbids the copy).

## Consequences

Settings navigation gains an AgentBrain entry and the Plugins section loses the addons tab. The confusing empty skills section is gone; agentBrain skills remain reachable through the `/` command menu, which reads the scope-aware catalog. The renamed component keeps the `settings.agentBrainAddons` locale namespace and its dictionaries, minus the three now-unused skills keys. This note supersedes the placement described in `.agents/notes/implemented/feature/2026-08-27-agentbrain-addons-tab-design.md`; that note's card, chip, and button design still holds.

## Verification

Rebuilt the client libs and web shell and screenshotted Settings: the navigation lists General, Models, Plugins, AgentBrain, Agent presets in that order, and the AgentBrain entry opens the addon management with its heading, intro, System group, bulk actions, and cards, with no skills section. `oxlint` and the client `tsc` build pass; the package has no unit tests.
