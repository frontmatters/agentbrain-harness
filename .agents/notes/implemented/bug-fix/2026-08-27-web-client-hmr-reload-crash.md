# Agent Note: disable web client-hmr; its reload blanks the page

Status: implemented

## Problem

The web app blanked to an empty `<div id="root">` after a client bundle changed while a page was open: a rebuild, or the client-hmr stat-poll catching up on a bundle rewrite after the machine slept. The console showed `dynamicCordisRunner.syncInspectManifest is not a function`, `inventory is not a function`, `cannot get required service "remote" in inactive context`, `cannot create effect on inactive context`, and `renderSlot('root') before any 'root' registration (boot order)`.

The cause is `client-hmr`'s live reload. On a real bundle content change it re-applies the client plugins, but the reload re-runs a consumer's `apply` before the Remote namespaces are re-established, so `ctx.remote.dynamicCordisRunner` has no methods and the `ui-cordis` and `cordis-client-runner` consumers throw. The tear-down then leaves the shell rendering `root` before its slot re-registers. The stack traces run through `md._reload → md._execute → new apply`, confirming the HMR reload as the trigger, not the SSE reconnect. It is deterministic: appending a byte to every `lib/client.js` while a page is open reproduces the blank page and the exact errors.

## Decision

Disable the `client-hmr` row in the web-app bundle (`packages/bundle/web-app/cordis.patch.yml`), the same choice already made for the base `hmr` row and for the same reason: the reload lifecycle is untested and re-applies consumers before `ctx.remote` is ready. With it off, a bundle rewrite no longer triggers a reload, so the served app stays stable across rebuilds and wake.

## Alternatives considered

**Fix the reload lifecycle.** The correct long-term fix is to re-establish `ctx.remote` before re-applying its consumers, then re-enable both HMR rows. Deferred: it is the untested path the disabled base `hmr` row already flags, and it is larger than this release needs.

**Gate client-hmr on a dev env flag.** Rejected as insufficient: the reload crashes in dev too (base `hmr` is already disabled), so `dev:web` hot-reload was effectively broken already; gating would only hide the crash in served mode while leaving a broken dev reload.

## Consequences

The served `abh web` no longer blanks when bundles change or on wake. `pnpm run dev:web` still rebuilds bundles, but the browser no longer auto-reloads them — refresh manually until the reload lifecycle is fixed (it was crashing rather than reloading before, so no working behavior is lost). Re-enabling either HMR row is blocked on the deferred reload fix.

## Verification

With the row disabled, restart `abh web` and append a byte to every `lib/client.js` while a page is open: the root stays rendered and the console stays clean (previously it blanked with the errors above). A normal load still opens the Plugins panel with no console errors, so removing the `/plugins/events` channel breaks nothing.
