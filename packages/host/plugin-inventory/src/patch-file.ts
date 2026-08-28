/**
 * Read and write the home user patch layer (`$ABH_HOME/cordis.patch.yml`) that
 * the boot include watches and live-reapplies. A GUI enable/disable persists as
 * a dedicated `{ id, disabled }` toggle patch, leaving any other patch the user
 * keeps for the same id untouched. The include's `entryListSchema` round-trips
 * `!!js` expressions, so rewriting the file never mangles hand-authored config.
 * @module @agentbrain-harness/host-plugin-inventory/src/patch-file
 */
import { readFile, writeFile } from 'node:fs/promises'
import { entryListSchema } from '@agentbrain-harness/cordis-plugin-include'
import yaml from 'js-yaml'

/** One patch row in the user layer; only `id` and `disabled` are read here. */
export interface PatchRow {
  readonly id?: string
  readonly disabled?: boolean | null
  readonly [key: string]: unknown
}

/** Whether a patch row is a GUI-managed toggle: it targets `id` and carries nothing but the disabled flag. */
function isTogglePatch(row: PatchRow, id: string): boolean {
  return row.id === id && Object.keys(row).every(key => key === 'id' || key === 'disabled')
}

/**
 * Parse the user patch layer, returning an empty list when the file is absent or empty.
 * @param path - absolute path of the home `cordis.patch.yml`.
 * @returns the patch rows, or `[]` when there is nothing to read.
 * @throws when the file exists but is not a YAML sequence (a corrupt user layer must fail loud, not be silently overwritten).
 */
export async function readPatchList(path: string): Promise<PatchRow[]> {
  let content: string
  try {
    content = await readFile(path, 'utf8')
  } catch (error) {
    // Only a missing file is a normal empty layer; any other read error propagates.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const parsed = yaml.load(content, { schema: entryListSchema })
  if (parsed === undefined || parsed === null) return []
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a YAML sequence of patch rows`)
  return parsed as PatchRow[]
}

/**
 * Upsert the GUI toggle patch for one entry id, preserving every other row.
 * @param rows - the current patch rows.
 * @param id - the Loader entry id being toggled.
 * @param enabled - the desired enablement (persisted as `disabled: !enabled`).
 * @returns a new row list with the entry's toggle patch set.
 */
export function upsertTogglePatch(rows: readonly PatchRow[], id: string, enabled: boolean): PatchRow[] {
  const next = rows.filter(row => !isTogglePatch(row, id))
  next.push({ id, disabled: !enabled })
  return next
}

/**
 * Serialize the patch rows back to the user layer through the include's dialect.
 * @param path - absolute path of the home `cordis.patch.yml`.
 * @param rows - the patch rows to write.
 */
export async function writePatchList(path: string, rows: readonly PatchRow[]): Promise<void> {
  await writeFile(path, yaml.dump(rows, { schema: entryListSchema }), 'utf8')
}
