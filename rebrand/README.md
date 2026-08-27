# Rebrand

agentbrain-harness is a hard fork of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness). The rebrand is **not** carried as commits to be merged forward; it is regenerated from [rules.json](rules.json) on top of whatever upstream snapshot the fork adopts.

That is deliberate. Upstream rewrites on the order of 1,600 files per release, and the rebrand rewrites ~3,400. Merging the two edit sets produces hundreds of conflicts whose only correct resolution is the mechanical result this script already computes. Regenerating is minutes; resolving is days, repeatedly.

## Adopting a new upstream snapshot

```sh
git fetch upstream
git checkout -b sync/rc-N upstream/master      # take upstream's tree as-is
python3 rebrand/rebrand.py --check             # see what the rules will do
python3 rebrand/rebrand.py --apply --retire-language zh
# re-apply the fork's own additions (see "What the script does not carry")
```

Then the manual steps below, and `--verify` to prove nothing upstream-named survives.

## What the rules cover

| Namespace | Upstream | Fork |
|---|---|---|
| npm scope + package | `@deepseek-ai/dsh-session` | `@agentbrain-harness/session` |
| CLI package | `@deepseek-ai/dsh` | `@agentbrain-harness/abh` |
| Binary | `dsh` | `abh` |
| Cordis module | `dsh-tool-bash` | `abh-tool-bash` |
| Environment | `DSH_HOME` | `ABH_HOME` |
| Home directory | `~/.dsh` | `~/.abh` |
| Manifest key | `"dsh": { bundle, profile }` | `"abh": { … }` |
| Identifiers | `dshHome`, `DshEnvironment` | `abhHome`, `AbhEnvironment` |
| Product name | `DeepSeek Harness` | `agentBrain Harness` |

## What is deliberately never rewritten

**The provider is not the brand.** DeepSeek is the model vendor this harness calls; only the harness is rebranded. `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `api.deepseek.com`, `platform.deepseek.com`, and model ids such as `deepseek-chat` are in the `keep` list and survive byte-identical. Bare `DeepSeek` in prose is left alone for the same reason — only `DeepSeek Harness` is a brand string.

**Frozen Agent Notes.** `.agents/notes/archived/` is sealed by repository policy. It is skipped entirely, and any path containing `archived/` is protected wherever it appears — otherwise live notes linking into sealed history would be rewritten to filenames that do not exist.

## Two traps that will bite a naive `sed`

1. **`handshake` contains `dsh`.** A global `s/dsh/abh/g` produces `hanabhake` in ~120 places. Every rule here anchors on a word boundary, which is why `find` strings look more complicated than they need to.

2. **A stale target directory turns a rename into a nesting.** `git mv src dst` moves `src` *into* `dst` when `dst` already exists, and still exits 0. Ignored content such as `node_modules` survives a branch checkout, so a directory named for the rebrand can still sit on disk while `git status` reports a clean tree — and the run then produces `packages/…/subagent-abh-sdk/subagent-dsh-sdk/`, a package whose manifest name no longer matches its location. That surfaces much later as `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. The script now refuses any rename whose target exists and exits non-zero; clear the reported paths with `git clean -xfd` and re-run.

3. **Regexes escape their slashes.** Source files that match package names write `@deepseek-ai\/dsh-`, which a rule matching the literal `@deepseek-ai/dsh-` misses. `scripts/cordis-walk.ts` and `scripts/slot-walk.ts` locate `declare module` blocks this way; missing the escaped form leaves both scanners silently finding nothing, which surfaces as ~150 bogus "partition violation" and "contract violation" errors from the catalog generators rather than as a rename failure. Both escaped forms are separate rules for exactly this reason.

## Manual steps the sweep cannot reach

Git state lives outside the working tree:

```sh
rm -rf .git/dsh-hooks .git/abh-hooks          # the installer recreates it
git config core.hooksPath "$PWD/.git/abh-hooks"
# .git/config.worktree, both lines:
#   [merge "dsh-translation-pairing"]  ->  [merge "abh-translation-pairing"]
#   name = DeepSeek Harness bilingual pairing records
#     ->  name = agentBrain Harness bilingual pairing records
```

The brand is embedded in git *state*, not only in filenames, and `install-lefthook.mjs` refuses to touch anything it does not recognise. Two values fail the run separately: the ownership marker `.git/<hooks>/.abh-lefthook-owned` carries `"owner": "<brand> worktree-local lefthook hooks"` inside its JSON, and `merge.abh-translation-pairing.name` carries the brand as its value. Renaming the hooks directory alone leaves both stale, so deleting the directory and letting `pnpm install` rebuild it is the shortest correct path.

Then reconcile and regenerate:

```sh
pnpm install
pnpm run build && pnpm run typecheck
for g in gen-cordis-catalog gen-client-catalog gen-tool-catalog gen-config-catalog \
         gen-persistence-catalog gen-scoped-events gen-cordis-inspect-catalog; do pnpm run $g; done
python3 rebrand/rebrand.py --verify
```

Generated catalogs embed package names, so they must be regenerated rather than swept.

## Languages

The fork is English-first with one secondary language. The i18n system is **kept**: sibling `foo.md` / `foo.<tag>.md` files, the `foo.i18n.yaml` consistency record, and the pairing gate that keeps the two sides honest.

`--retire-language zh` removes the Chinese prose and the pairing records that described those pairs, leaving the machinery in place. It does not translate anything: a record is recreated by `pnpm run verify-translation-pairing --write <file>` once its replacement translation exists.

Moving the secondary language from `zh` to `nl` is a code change, not a sweep rule — the tag is structural. It lives in:

- `scripts/project-doc-site.ts` — `counterpartSource()` maps `foo.md` ↔ `foo.zh.md`
- `website/docs.ts` — `pairedPages()` derives the translated source, and `DocsLocale` names the route tree
- `website/.vitepress/config.ts` — the `locales` record, its labels and theme strings
- the translation-pairing scripts under `scripts/`

## What the script does not carry

The fork's own content is not derivable from upstream and must be re-applied by hand after a sync:

- the agentBrain memory-vault plugin and its deep integration with [agentbrain](https://github.com/frontmatters/agentbrain)
- installer scripts
- ambient `.d.ts` restorations
- Vite alias fixes
- English-root documentation locale

Keep these as a small, reviewable patch series on top of the regenerated base; that is what makes the next sync cheap.
