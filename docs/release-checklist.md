# ABH release checklist

This checklist is the maintainer source of truth for publishing the `abh` release family to npm. The release scripts own package discovery, dependency ordering, payload validation, and registry idempotency; the workflow owns the CI execution boundary.

## Product readiness

- [x] AgentBrain memory documents use the canonical UUID5 and typed-frontmatter format.
- [x] Real Loader/composition tests cover skills, commands, and shared memory across sessions.
- [ ] Installer and uninstaller pointer management has an exact reversible marker.
- [x] The AgentBrain context section is provider-neutral.
- [ ] Web and headless snapshots cover the assembled AgentBrain integration.
- [ ] The integration's focused tests, build, package-invariant checks, and Web snapshot lane pass.

## Release preparation

- [ ] The release scope is intentional: all manifests matched by the `abh` release family are ready to publish.
- [ ] The worktree contains one reviewable release commit or a reviewed release stack; generated `dist/` output is not committed.
- [ ] The release version is chosen (`rc` for a prerelease or stable semver for a public release).
- [ ] Every `abh` release member carries the same version.
- [ ] Release notes describe the user-visible changes and known limitations.

## Local verification

Run these commands from the repository root on the release commit:

```sh
pnpm install --frozen-lockfile
pnpm run check:all
pnpm run build:official
pnpm run release:verify --family abh
pnpm run release:pack --family abh --out dist/npm
pnpm run release:pack --family vendor --out dist/npm-vendor
pnpm run release:verify-packed-install \
  --family abh \
  --from dist/npm \
  --from dist/npm-vendor
pnpm run test:web
```

- [ ] Every command passes. The packed-install rehearsal also needs the separately published native `@agentbrain-harness/node-addon-landlock-run` family, or its platform tarballs supplied to the rehearsal.
- [ ] The packed install test uses the tarballs produced by this exact build.
- [ ] The final tarballs contain no source files, declaration maps, or stale artifacts.

## Registry and GitHub configuration

- [ ] The `@agentbrain-harness` npm scope is owned by the publishing account.
- [ ] Trusted publishing is configured on every published package: run [`trust-github.sh`](../scripts/release/trust-github.sh) once as an org owner. It pins this repository, the `release.yml` workflow, and the `npm-publish` environment as each package's trusted publisher, so the workflow publishes over OIDC with no stored npm token. A newly added package needs a trust config before its first publish; re-run the script.
- [ ] The GitHub `npm-publish` environment has its required reviewers and protection rules.
- [ ] The repository can publish public scoped packages.

## Publish

- [ ] Push the release commit and create the matching `abh-v<version>` tag.
- [ ] Confirm the tag points at the commit that passed the local checks.
- [ ] Start the `Release (abh)` workflow from that tag with `publish: true`.
- [ ] Confirm the pack job passes before the publish job runs.
- [ ] Confirm the publish job reports every package as published or already present with identical integrity.

The workflow is [`release.yml`](../.github/workflows/release.yml). The release-family rules are [`families.ts`](../scripts/release/families.ts); packing and publication are implemented by [`pack.ts`](../scripts/release/pack.ts) and [`publish.ts`](../scripts/release/publish.ts).

## Post-release verification

- [ ] Install `@agentbrain-harness/abh@<version>` in a clean temporary directory.
- [ ] Run `abh --help` and one keyless local smoke path.
- [ ] Run `abh web` against the installed package and verify the assembled Web UI.
- [ ] Confirm the npm package pages, README links, release notes, and dist-tags.
- [ ] Record the published version, tag, workflow run, and any deferred work in the project handover.

## Ownership map

| Concern | Canonical owner |
|---|---|
| Package set, versions, order, and payload rules | `scripts/release/families.ts` |
| Pack and packed-install commands | `scripts/release/pack.ts` and `scripts/release/verify-packed-install.ts` |
| Registry publication and retry behavior | `scripts/release/publish.ts` |
| CI trigger, credentials boundary, and artifact handoff | `.github/workflows/release.yml` |
| Current AgentBrain integration gaps | `HANDOFF.md` |
| This maintainer sequence | This document |
