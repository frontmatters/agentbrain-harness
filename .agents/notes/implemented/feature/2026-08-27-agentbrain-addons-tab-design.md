# Agent Note: align the AgentBrain addons tab with the settings design system

Status: implemented

## Problem

The AgentBrain addons tab (`AgentBrainAddonsSettingsTab`) rendered each addon as a dense block: its platform, privacy, per-client support, and skills stacked as muted paragraphs, and its actions were raw `<button>` elements. Next to the Models and Plugin-configuration tabs, which use design-system cards and the `Button` primitive, it read as unfinished. A latent display bug also showed `· null` for an addon whose `version` is `null`, because the render tested `=== undefined` on a `string | null` field.

## Decision

Restyle the tab to the shared settings look. Each addon is a card with a bold name, a system/local tag, an `id · version` subtitle, and a single compact chip row for platform, privacy, per-client support, and skills. Actions use the `@agentbrain-harness/client-ui-primitives` `Button`: `Test` and `Run tests` as `ghost`, and the enable/disable action as a solid `primary` (enable) or `outline` (disable) pill, matching the rest of settings. The skills section keeps the same card and button treatment under a bordered subheading. The `string | null` fields are tested with `=== null`, so a null version or privacy is omitted rather than printed.

## Alternatives considered

**Hand-style the raw buttons with CSS.** Rejected: it duplicates the `Button` token families and drifts from the rest of settings the moment those tokens change; reusing the primitive keeps one source of truth.

**Keep the metadata paragraphs and only add spacing.** Rejected: the stacked muted lines were the core readability problem, not the gaps between them; a single chip row is both denser and clearer.

## Grouping and bulk actions

The list is split into two sections, `System` (bundled) first and `Local` second, each sorted alphabetically by name, replacing the host's local-then-system directory order. Each section header carries `Enable all` and `Disable all` quick actions that toggle only that group's addons (disable-all confirms once), so a deployment's system addons and a user's local addons are managed separately.

## Consequences

The tab now matches the Models and Plugin-configuration tabs in card layout, chip metadata, and buttons. `ui-settings-addons` gains a dev dependency on `client-ui-primitives` (a seeded platform module, externalized in the client bundle like `ui-slots`); the tsconfig already referenced it. The change is presentation only: the list, enable/disable, check, test, and skill-toggle behavior is unchanged.

## Verification

Rebuilt the client bundles and the web shell and screenshotted Settings to Plugins to AgentBrain addons: cards, chips, and pill buttons render in line with the other tabs, with no `null` text. `oxlint` and `hygiene` pass; the package has no unit tests.
