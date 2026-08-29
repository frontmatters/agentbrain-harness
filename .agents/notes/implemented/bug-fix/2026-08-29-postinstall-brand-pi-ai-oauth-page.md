# Agent Note: brand pi-ai's OAuth callback page on install

Status: implemented

## Problem

After an account sign-in (ChatGPT, Claude, ...), pi-ai serves its own confirmation page at the OAuth loopback callback, carrying pi-ai's default logo. This repo swaps that logo for the agentBrain mark through a pnpm patch (`patches/@earendil-works__pi-ai@0.82.1.patch`, one file: `dist/auth/oauth/oauth-page.js`). pnpm patches only apply inside this repo — they never ship to consumers who install the published `@agentbrain-harness/*` packages, whose `@earendil-works/pi-ai` is the unpatched registry copy. So the branding worked in dev but a fresh install showed pi-ai's original page, which is what a user reported after installing rc.9 on another machine.

## Decision

`@agentbrain-harness/abh` (the package users install) runs a `postinstall` that re-brands the installed pi-ai callback page: `apps/cli/postinstall/brand-oauth-page.mjs` locates `@earendil-works/pi-ai/dist/auth/oauth/oauth-page.js` by walking up `node_modules` from its own directory and rewrites it with a branded copy shipped beside the script (`oauth-page.branded.js`). The lookup is a filesystem walk, not `require.resolve`: pi-ai's `exports` map hides both `./package.json` and its dist files, so resolution through Node's exports would throw. The self-executing entry compares `realpathSync` of its own path and `process.argv[1]` so a symlinked invocation path (macOS `/tmp`, npm's script dirs) still triggers the branding. The swap is **content-gated, never version-gated**: it acts only when the installed file is byte-identical to a vetted pristine original (`ORIGINAL_SHA256`), is a no-op when already branded (`BRANDED_SHA256`), and leaves anything else untouched — a page pi-ai has changed keeps pi-ai's own version, unbranded, rather than a stale brand. The whole entry is wrapped so any failure is swallowed: cosmetic branding must never break a host install. This is the patch-package pattern applied by the library to its own dependency.

## Alternatives considered

**Vendor pi-ai under the `@agentbrain-harness` scope** (like Cordis). Rejected: pi-ai publishes about every 2.7 days (43 versions in ~4 months) because fresh model-catalog data is the point of depending on it; vendoring would freeze a fast-moving package and demand a full re-vendor per release. Measurement decided this — `oauth-page.js` is byte-stable across 0.82.1–0.84.4 while `api/`, `providers/`, and `providers/data/` churn every release, so the branding target barely moves and content-gating covers a wide version range with near-zero maintenance.

**Upstream a configurable-logo option to pi-ai** (`github.com/earendil-works/pi`). The clean endgame — own the logo through a seam, borrow the flow — but it depends on an external maintainer accepting the change, so it cannot ship the fix now. Left as a possible follow-up that would retire this postinstall.

**Symlink the callback page to our copy.** Rejected: functionally identical to the gated overwrite but adds cross-platform fragility (Windows symlink privileges, installers that do not preserve symlinks, integrity checks) for no gain.

## Consequences

pi-ai stays a transitive dependency (through `llm-pi-ai`); the filesystem walk finds it wherever the installer hoists it, and a tree without pi-ai just yields `not-found`. The `check-workspace-constraints` allowlist for the abh `files` field gains the two shipped postinstall paths (`brand-oauth-page.mjs`, `oauth-page.branded.js`). The fix reaches only installers that run dependency lifecycle scripts: npm and yarn do by default, pnpm needs the script allowlisted, and `--ignore-scripts` skips it — in every skipped case the page falls back to pi-ai's original, the same cosmetic state as before, never a broken install. When abh adopts a pi-ai release that changes `oauth-page.js`, the gate stops branding until `oauth-page.branded.js` and the two hashes are refreshed from the new original. The exported `sha256`/`decideAction`/`brandOauthPage` carry unit tests; the self-executing entry is coverage-ignored, and `apps/cli` sits outside the per-file coverage gate.

## Verification

`sha256`, `findPiAiOauthPage`, `decideAction`, and `brandOauthPage` carry unit tests over real temporary `node_modules` layouts (not a mocked resolver — an earlier mocked test hid a real `require.resolve` failure). Beyond the unit tests, the whole path was exercised end to end: a pristine `@earendil-works/pi-ai@0.82.1` was unpacked into a throwaway tree, the postinstall was run exactly as npm invokes it (`node postinstall/brand-oauth-page.mjs` from the package dir), and the callback page flipped from pi-ai's logo (`viewBox="0 0 800 800"`) to the agentBrain mark (`viewBox="0 0 40 40"`, the branded hash); a second run stayed branded. The self-executing entry is coverage-ignored, and `apps/cli` sits outside the per-file coverage gate.

## Related

- [sign-in-first onboarding](../feature/2026-08-25-onboarding-sign-in-first-chatgpt-claude.md) — the OAuth flow whose confirmation page this brands.
