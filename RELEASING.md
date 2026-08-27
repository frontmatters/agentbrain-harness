# Releasing agentBrain Harness

This runbook is the single entry point for publishing to npm. Everything here
lives in the repository, so a fresh clone on any machine reproduces the process
after one authentication step.

## Scope and organization

All packages publish under the `@agentbrain-harness` npm scope. The scope is owned
by the `agentbrain-harness` organization on npmjs.com (created 2026-08-21, Free
plan, public packages only), administered by the fork maintainer's account.

Every publishable manifest sets `"publishConfig": { "access": "public" }`, so no
publish command passes `--access`; the manifest owns the level. The Free plan is
sufficient because every package is public.

## Three independent sequences

Three package groups release on separate version lines, tags, and workflows. They
share no version and no trigger. See the Agent Note
[`.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md`](.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)
for the full rationale, and `scripts/release/families.ts` for the exact member lists.

| Sequence | Members | Bump command | Tag | Workflow |
|---|---|---|---|---|
| abh | `packages/*/*` + `apps/*` (public set) | `pnpm run release:abh` | `abh-v<version>` | `.github/workflows/release.yml` |
| vendored framework | the nine `vendor/*` packages | `pnpm run release:vendor` | `vendor-<package>-v<version>` | `.github/workflows/release-vendor.yml` |
| native | `native/landlock-run/packages/*` | (own flow) | `landlock-run-v<version>` | `.github/workflows/landlock-run-release.yml` |

## One-time authentication setup

Publishing needs an npm credential. Two paths exist; CI is the reproducible one.

### CI (recommended, reproducible)

The workflows publish on a tag. `release.yml` reads a granular access token from the
repository secret `NPM_TOKEN` through `NODE_AUTH_TOKEN`.

1. On npmjs.com, open Access Tokens and create a **Granular Access Token**.
2. Scope it to the `@agentbrain-harness` organization with read and write on packages.
3. Set an expiry and require 2FA (see the deprecation note below).
4. In the GitHub repository, add it as the Actions secret `NPM_TOKEN`.

Any machine that pushes a release tag then triggers the same published result. No
local npm login is involved.

### Local (fallback, per machine)

`scripts/publish-npm-baseline.ts` packs and publishes from one machine and needs an
interactive login. Run `npm login` as a member of the `agentbrain-harness` org, then
`pnpm run publish:npm-baseline`. This path excludes the vendored framework.

## Cut a release (abh family)

1. `pnpm run release:abh <patch|minor|major|X.Y.Z>` bumps every abh manifest and the
   workspace root to one version, runs `pnpm install --lockfile-only`, and commits.
2. Merge the bump commit to `master`.
3. Create and push the tag `abh-v<version>`.
4. `release.yml` runs `release:verify`, `build:official`, `release:pack`,
   `release:verify-packed-install`, and `release:publish --family abh` against the tag.

A version with a prerelease segment (for example `0.0.1-rc.1`) publishes under the
`next` dist-tag; a plain version takes `latest`.

The vendored framework follows the same shape with `release:vendor` and per-package
`vendor-<package>-v<version>` tags; the published version is the higher of the manifest
version and the last published version with the patch incremented.

## Reproduce on a new machine

1. Clone the repository.
2. `pnpm install` (Node `^22.19 || >=24`).
3. For CI publishing, set the `NPM_TOKEN` repository secret once. For local publishing,
   run `npm login`.
4. Follow **Cut a release** above.

No machine keeps release state outside the token or login. The versions live in the
committed manifests, and CI never writes to the repository.

## 2FA token deprecation

npm restricts tokens that bypass 2FA: account changes from August 2026 and direct
publishing from January 2027
([changelog](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)).
Use a granular token with 2FA enabled, and plan to move CI to OIDC trusted publishing
before the direct-publishing cutoff.
