# Agent Note: Make addon inventory resilient to filesystem metadata

Status: implemented

## Problem

The addon settings tab calls the Host inventory Remote before rendering its rows. The canonical AgentBrain addon directory can contain unrelated entries such as macOS `.DS_Store` files. Treating every directory entry as an addon id made the complete inventory request fail on the first invalid name, so the Web tab showed its unavailable state instead of any addons.

## Decision

The Host inventory scanner filters directory names against the strict addon-id grammar before parsing them. It scans local addons before bundled addons and keeps the first manifest for a duplicate id, so a local manifest is authoritative. Manifest support rows are parsed from the YAML block with actual regular-expression escapes.

## Alternatives considered

**Let `parseAddonId` reject every directory entry.** Rejected because addon roots are filesystem directories and may contain metadata that is not registry data.

**Let bundled addons override local addons.** Rejected because local addons are the machine-specific override layer.

## Consequences

The inventory Remote remains strict for ids received from callers while discovery ignores unrelated filesystem entries. The settings tab can render the inventory when macOS metadata is present, and duplicate local manifests no longer resolve to bundled metadata.

## Verification

Run `pnpm exec vitest run packages/host/agentbrain-addons/tests --coverage=false` from the repository root. The regression fixture includes `.DS_Store`, duplicate manifests, and a support entry.
