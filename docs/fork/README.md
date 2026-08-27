# agentbrain-harness fork notes

Working state of the fork, written to be picked up on another machine. For the rebrand transform itself see [rebrand/README.md](../../rebrand/README.md).

## What this fork is

agentbrain-harness is a **hard fork** of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), rebranded and extended with a deep integration with [agentbrain](https://github.com/frontmatters/agentbrain).

Hard fork is a deliberate choice, not a drift. Upstream landed its entire 12,939-commit history in about three months and changes ~1,600 files per release. The rebrand rewrites ~34,000 names across ~4,600 files. Merging those two edit sets means hundreds of conflicts per sync whose only correct resolution is the mechanical one the rebrand script already computes — measured at **310 conflicts** for rc.7 → rc.8 alone, before the `dsh` → `abh` rename was even applied.

So the fork does not merge from upstream. It **re-derives** itself on top of a chosen upstream snapshot.

## How a sync works

```
upstream snapshot (a release tag)
  + rebrand/rebrand.py --apply --retire-language zh     mechanical, ~minutes
  + the fork's own patch series                          hand-maintained
  = the fork
```

Everything mechanical lives in [rebrand/rules.json](../../rebrand/rules.json) so it never has to be re-decided. Everything else must stay small and reviewable, because it is what gets re-applied by hand each time.

Full procedure and the manual git-state steps: [rebrand/README.md](../../rebrand/README.md).

## Repository remotes

| Remote | URL | Use |
|---|---|---|
| `origin` | the fork's private git remote (`ssh://git@<host>/<owner>/agentbrain-harness.git`) | the fork; push here |
| `upstream` | `https://github.com/deepseek-ai/deepseek-harness.git` | read-only reference; push URL is deliberately set to an invalid value |

A pristine upstream checkout for diffing sits beside the repo at `../deepseek-harness-upstream`.

Anchor diffs at the merge base, not at `upstream/master`, or the fork's own changes and upstream's newer work are conflated:

```sh
git diff 99f6f02fec master          # what the fork changed
git diff 99f6f02fec upstream/master # what upstream added since
```

## Naming

| Namespace | Upstream | Fork |
|---|---|---|
| npm scope | `@deepseek-ai/` | `@agentbrain-harness/` |
| package | `@deepseek-ai/dsh-session` | `@agentbrain-harness/session` |
| CLI | `@deepseek-ai/dsh`, bin `dsh` | `@agentbrain-harness/abh`, bin `abh` |
| environment | `DSH_*` | `ABH_*` |
| home | `~/.dsh` | `~/.abh` |

The npm scope, publishing account, and public-package configuration are release prerequisites tracked in the [ABH release checklist](../release-checklist.md). The unscoped `abh` package is not the ABH distribution; use the scoped CLI package after publication.

Publishing `@agentbrain-harness/abh` requires the complete `abh` release family to be published under the same scope. The release scripts derive that set and its dependency order from the workspace manifests.

## Languages

English is primary. The i18n system is kept — sibling `foo.md` / `foo.<tag>.md`, the `foo.i18n.yaml` consistency record, and the pairing gate. Chinese was retired with `--retire-language zh` (986 translations plus their pairing records).

Dutch as the secondary language is **not** implemented. The secondary tag is structural, so it is a code change rather than a sweep rule; the files that hold it are listed in [rebrand/README.md](../../rebrand/README.md#languages). Translating the corpus is a separate content project — adding a locale later is cheap, maintaining a full second translation is not.

The documentation website was separately changed to serve English at the root with Chinese under `/zh/`; that work predates the rebuild and lives on `docs/en-default-locale`.

## Verification status of `rebuild/rc8`

| Check | Result |
|---|---|
| `pnpm install` | passes |
| `pnpm run build` | passes |
| `pnpm run typecheck` | passes |
| `rebrand/rebrand.py --verify` | passes — no upstream name survives |
| `pnpm run test` | **not yet run on this branch** |

The build passing is the meaningful signal: the same tree built by hand on rc.7 failed here, because two module scanners match package names through regexes that escape their slashes and the hand-made sweep missed that form. The rules cover it, so the failure did not recur.

The test suite is the outstanding gap. On the superseded `rename/dsh-to-abh` branch it left 53 failures against 14 on clean master — roughly 39 attributable to the rename. Those were never diagnosed, because the rebuild replaced that branch. Expect fewer here, since the rules are more complete than that hand sweep, but treat it as unmeasured rather than fixed. When running it, compare against the known-broken baseline below rather than against zero.

## Open work

- **Provider-agnostic onboarding.** The first-run notice reads *"Add an API key to get started / Configure the official DeepSeek provider to start building"*, which hardcodes one vendor. It lives in `packages/client/ui-settings-models` (`welcome-notice`). Upstream already ships a second provider (`llm-pi-ai`), so the seam exists; the wording and flow do not use it.
- Complete the [ABH release checklist](../release-checklist.md), including npm scope configuration.
- **Dutch secondary locale.**
- **agentbrain deep integration.**

## Known-broken baseline

Measured on clean `master` before any of this session's work, so these are not regressions:

- `doc-sync` fails 7 gates: export jsdoc, tool catalog, config catalog, doc graphs, md wrap, package README model experience, translation pairing.
- **848 bilingual pairs are out of sync** — the pairing gate is effectively broken on the corpus. Retiring Chinese removes most of this by removing the corpus.
- `gen-module-graph` and `gen-doc-graphs` fail on a genuine cyclic workspace dependency (`acp`, `api-gateway`, `api-remotes`, …) that pnpm also warns about on install.

Anything not on this list that fails is worth treating as new.

## Branches

| Branch | Holds |
|---|---|
| `master` | rc.7 base with `dsh` names and the first rebrand pass |
| `rebuild/rc8` | rc.8 re-derived through the rebrand rules — the intended future base |
| `chore/rebrand-tooling` | the rebrand transform |
| `docs/en-default-locale` | English documentation root |
| `rename/dsh-to-abh` | hand-made rename on rc.7; superseded by `rebuild/rc8`, keep only as reference |
