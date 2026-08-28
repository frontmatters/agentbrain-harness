/** Projection of the current Cordis Loader plugin entries, plus allowlisted GUI enable/disable. */

import type { Context, FiberState } from '@agentbrain-harness/cordis'
import type {} from '@agentbrain-harness/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@agentbrain-harness/typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import z from '@agentbrain-harness/schemastery'
import { abhHomePath } from '@agentbrain-harness/home-paths'
import { readPatchList, upsertTogglePatch, writePatchList } from './patch-file.ts'
import type {
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
  PluginToggleResult,
} from './types.ts'

export type * from './types.ts'

/**
 * The home user patch layer the boot include watches and live-reapplies.
 * Mirrors `PROFILE_PATCH_FILENAME` in `@agentbrain-harness/app-boot`; a toggle
 * write lands here and takes effect without a restart.
 */
const HOME_PATCH_FILENAME = 'cordis.patch.yml'

/** Deployment policy for the plugin inventory surface. */
export interface PluginInventoryConfig {
  /** Loader entry ids the deployment allows the GUI to enable/disable; all others stay read-only. */
  readonly togglable: readonly string[]
}

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/**
 * The id a home patch targets for a top-level include entry: its tree id
 * without the `include:` prefix. A user patch in `$ABH_HOME/cordis.patch.yml`
 * matches the boot include's entry ids (the bundle patch ids), while the
 * inventory reports the live tree id, so the allowlist and the written patch
 * both key on this include-relative form.
 */
function patchTargetId(entryId: string): string {
  return entryId.startsWith('include:') ? entryId.slice('include:'.length) : entryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

/** Remote service exposing the Loader's current non-group entry state and allowlisted toggles. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  /** Deployment allowlist for GUI enable/disable; empty leaves every entry read-only. */
  static Config = z.object({
    togglable: z.array(z.string()).default([]),
  }) as z<PluginInventoryConfig>

  /** Loader entry ids the deployment allows the GUI to toggle. */
  private readonly togglable: ReadonlySet<string>

  constructor(ctx: Context, config: PluginInventoryConfig) {
    super(ctx, 'pluginInventory')
    this.togglable = new Set(config.togglable)
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Current non-group Loader entries in Loader order.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push({
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
        togglable: this.togglable.has(patchTargetId(entry.id)),
      })
    }
    return { entries }
  }

  /**
   * Persist a GUI enable/disable for one allowlisted entry to the home user
   * patch layer, which the boot include watches and live-reapplies. Refuses an
   * entry outside the deployment allowlist so a core plugin can never be
   * disabled from the panel.
   * @param entryId - Loader entry id to toggle.
   * @param enabled - Desired enablement, persisted as `disabled: !enabled`.
   * @returns The entry id and the enablement now written.
   * @throws when the entry is not in the deployment allowlist.
   */
  @Remote('setEnabled')
  async setEnabled(entryId: PluginEntryId, enabled: boolean): Promise<PluginToggleResult> {
    const target = patchTargetId(entryId)
    if (!this.togglable.has(target)) throw new Error(`plugin entry ${JSON.stringify(entryId)} is not user-togglable`)
    const path = abhHomePath(HOME_PATCH_FILENAME)
    const rows = await readPatchList(path)
    await writePatchList(path, upsertTogglePatch(rows, target, enabled))
    return { entryId, enabled }
  }
}

export default PluginInventoryGateway
