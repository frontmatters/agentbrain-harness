# Agent Note: GUI enable/disable for allowlisted plugins via the home patch layer

Status: implemented

## Problem

The plugin inventory settings tab was read-only: it showed each Loader entry's enablement and fiber phase but offered no way to enable or disable a plugin from the GUI. The one runtime plugin-lifecycle surface, `cordis-host-runner`, is session-scoped model self-modification (the agent adds and removes dynamic Cordis plugins during a turn), not a deployment control, and nothing persisted a user's enable/disable choice. Disabling a core plugin from a panel could also brick a deployment, so any control needs a safety boundary.

## Decision

The `PluginInventoryGateway` gains a data-driven `togglable` allowlist Config and a `setEnabled` remote. `setEnabled` writes a dedicated `{ id, disabled }` toggle patch to the home user patch layer (`$ABH_HOME/cordis.patch.yml`), which the boot include already watches through `watchUserPatches` and transactionally re-applies, so a toggle takes effect live with no restart. The inventory reports `togglable` per entry, and the tab renders an enable/disable button for allowlisted entries only; everything else stays read-only. Ids reconcile through `patchTargetId`: the inventory reports the live tree id (`include:ui-goal`), while the allowlist and the written patch key on the include-relative id (`ui-goal`) the boot include matches. A dedicated toggle patch (only `id` and `disabled`) is upserted, so any other patch the user keeps for the same id survives.

## Alternatives considered

**Remount the plugin fiber from scratch on toggle.** Unnecessary: the include's user-patch reload already performs a live, transactional re-apply. Writing the patch and letting the existing watcher reconcile reuses the same config-HMR path the profile and home layers run on, which is distinct from the module-reload `hmr` that was disabled for blanking the page.

**Write toggles to a separate machine-managed overrides file to avoid touching the user's `cordis.patch.yml`.** Rejected after verifying the risk was unfounded: the include's `entryListSchema` gives the `!!js` type a `represent` and predicate, so parsing and re-dumping the file round-trips `!!js` expressions faithfully. A shared-file write never mangles hand-authored config, and it needs no new boot wiring.

**A denylist of core plugins instead of an allowlist.** Rejected: an allowlist is safe by default, so a newly added plugin is never togglable until a deployment opts it in, and core plugins can never be reached from the panel.

## Consequences

`host-plugin-inventory` gains dependencies on `@agentbrain-harness/schemastery` (the Config schema), `@agentbrain-harness/home-paths` (the home path), `@agentbrain-harness/cordis-plugin-include` (the `entryListSchema` dialect), and `js-yaml`. The web-app bundle allowlists seven optional leaf features (`session-log-download`, `ui-goal`, `ui-jobs`, `ui-message-feedback`, `ui-deliverables`, `ui-reference`, `ui-workflow-run`); each is a client UI panel that no other bundle entry injects, so disabling one has no dependents. A deployment extends the list through the entry's `config.togglable`. A restart is only the loader's fallback for an entry that cannot re-apply live; the common case is live. The plugin-config web snapshot may need refreshing if it captures an expanded togglable entry.

## Verification

Unit tests cover the gateway and the patch-file read/upsert/write at 100% per-file, including the `!!js` round-trip, the allowlist refusal, and the include-prefix strip. End to end against the running web app: the four allowlisted entries reported `togglable: true`; toggling `ui-goal` off from the panel wrote `{ id: ui-goal, disabled: true }` to the home layer and the host live-disabled `include:ui-goal` (`enabled: false`, no root fiber) with no page blank and settings still open; removing the patch live-reverted it to enabled and active.
