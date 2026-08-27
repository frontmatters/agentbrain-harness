# Agent Note: Web e2e lane English migration and replay refresh

Status: proposed

Superseded 2026-08-24 by `../../implemented/testing/2026-08-24-web-e2e-lane-restore-and-baseurlenv.md`. The lane was restored without the re-record this proposal scoped: the `MISSING_CREDENTIAL` failures were a scaffold provider-id mismatch (replay published `deepseek-official` while the composition routed `default`), fixed by wiring the stub replay adapter to `default` plus the legacy id for seed fixtures. Goldens were regenerated with a keyless `ABH_SNAPSHOT=refresh`, not a keyed record pass.

Parked 2026-08-23. Proposal steps 1 and 2 (scoping the ambiguous `getByLabel('Provider')` selectors with `{ exact: true }`, and replacing the Simplified-Chinese clock normalizers with the English `{y}-{m}-{d} HH:mm` / `{d}-{m} HH:mm` formats while dropping the dead Chinese duration normalizer) landed in commit `fa9c29bc38`; steps 3 and 4 (re-record the ~17 `session.jsonl` fixtures and regenerate the `.expected.md` snapshots against the English flow) remain, so the Chinese under `apps/web/tests/snapshots/` is still present. Superseding decision: the record lane must not require `DEEPSEEK_API_KEY`. `scaffold.ts` still mounts `llm-deepseek` (id `deepseek-official`) keyed by `DEEPSEEK_API_KEY` for record mode; the generic `llm-pi-ai` adapter the base bundle already uses supports any OpenAI-compatible provider through a configured route and an `apiKeyEnv` reference. Before re-recording, migrate record mode to `llm-pi-ai` so the harvest runs against whatever provider the operator configures, then re-record and verify keyless with `pnpm run test:web`.

## Problem

The locale migration replaced the shipped Simplified-Chinese UI with Dutch plus an English fallback, and the follow-up removed Chinese from every remaining surface. The `apps/web` browser e2e lane was recorded against the old Chinese-default UI, so it no longer passes: `pnpm run test:web` reports 77 failed tests across 34 files.

The Chinese-removal source edits are already committed (commit `5936cf180e`): every hardcoded Chinese assertion is now the English dictionary value the app renders, invented payloads are Dutch, the four shipped agent presets and the welcome-notice mirror are English, and the `zh-CN` browser pin was renamed to a neutral unshipped locale. What remains is regenerating the lane's recorded artifacts and repairing a few selectors, which this note scopes so the work is not lost.

## The failure breakdown

The 77 failures are not one cause. They split three ways.

**llm-replay fixture drift, 48 failures.** `llm-replay: fixture not fully consumed, the scenario drove fewer model calls than recorded` (thrown at `packages/test-support/llm-replay/src/index.ts:766`, via `scaffold.ts` close). These appear in files this migration never edited (`lifecycle-chrome`, `code-mode-round`, `live-interactions`, `cordis-tool-round`), so the recorded `session.jsonl` fixtures, not the Chinese edits, are stale against the current flow.

**Timeout cascades, 46 failures.** A scenario waits on UI text or state that never settles, then times out. Many are downstream of a stalled replay; some are a wait on a locator whose English name this note has not yet verified.

**Selector ambiguity, 3 failures.** English labels are less unique than the Chinese ones were: `getByLabel('Provider')` in `models-settings.e2e.ts` now matches a field label and an `Edit provider` aria-label, a strict-mode violation.

## Proposal

Bring the lane green in this order, because each step unblocks the next.

1. Fix the deterministic selector ambiguities (3). Scope the ambiguous `getByRole`/`getByLabel` calls to the field, or use `{ exact: true }` and the precise English label. No key or rebuild loop is required to reason about these.
2. Update the snapshot date normalizers. `scaffold.ts` still strips Chinese-format timestamps (`\d{4}年\d{1,2}月`, `约\d+天`). The app now renders the `clock` and `duration` dictionary formats (`{y}-{m}-{d}`, English and Dutch duration words), so the normalizers must match those or dynamic dates leak into snapshots and make them flaky.
3. Re-record the replay fixtures. The lane is built to be re-recorded: `record` mode (`scaffold.ts` header) drives the scenarios against the real adapter and harvests fresh `session.jsonl` fixtures from live session memory. Run `ABH_SNAPSHOT=record` over `vitest.web.config.ts` with a `DEEPSEEK_API_KEY` set, which regenerates the ~17 session fixtures and the `.expected.md` snapshots against the current English flow. Verify with the keyless `pnpm run test:web` (replay mode).
4. Regenerate the `.expected.md` snapshots as the record pass produces them; this migration deliberately reverted the partial `refresh` output so the tree carries no half-updated snapshots.

## Alternatives considered

**Edit the 17 `session.jsonl` fixtures by hand.** Each fixture is a recorded transcript of model calls; a wrong hand-edit desyncs the replay silently. The lane exists precisely so recording is mechanical, so hand-surgery trades a one-command re-record for error-prone manual work across 48 drifted scripts.

**Leave the lane red.** The lane is not in `pnpm run test`; it needs a build and a browser, so red here does not block the main gates. But it is the only browser-level regression coverage for the assembled web composition, and a permanently-red lane stops catching real breakage.

**Revert the Chinese-removal edits.** This keeps the lane recorded against Chinese, but the app no longer renders Chinese, so the lane would still be red and the product would keep Chinese assertions. Strictly worse.

**Re-record without first fixing the stalls.** Recording replays the scenario against a live model; a scenario that stalls on a wrong English locator records fewer calls, baking the drift in. The selector and locator fixes must land first.

## Acceptance criteria

- `pnpm run test:web` passes with no `ABH_SNAPSHOT` override (keyless replay).
- No Chinese remains under `apps/web/tests` except a deliberate CJK-subject case (`markdown-cjk-strong.e2e.ts`), and the `.expected.md` snapshots render the English UI.
- The scaffold normalizers collapse the current date and duration formats, so a second `refresh` run produces no snapshot diff.

## Risks

**Needs a real `DEEPSEEK_API_KEY` and spends live model calls.** Re-recording ~17 browser scenarios drives real requests; the run costs tokens and depends on provider availability. This is the lane's normal maintenance cost, not new.

**Recording may surface that some drift is a genuine flow change.** If a scenario legitimately makes one fewer call now (for example a skipped title-generation), the fixture shrinks and the assertion count must follow; the record pass reveals which failures are stale fixtures versus real behavior differences.

**The lane is timing-sensitive.** Even after re-recording, replay waits are interval-based; a normalizer or wait left too tight reintroduces flakiness.
