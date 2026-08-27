/**
 * One reusable settings-write sequence under optimistic concurrency: describe to
 * read a namespace's current revision, then mutate it with that expected
 * revision so the host rejects a stale write. The default-model write and the
 * local-route provisioning both use it rather than re-deriving the dance.
 *
 * @module @agentbrain-harness/client-ui-settings-models/settings-mutate
 */

import type { IApiClient, SettingsPathOpView } from '@agentbrain-harness/api-remotes/client'

/** The subset of the settings wire face a namespace mutation needs. */
export type SettingsMutateFace = Pick<IApiClient['settings'], 'describe' | 'mutate'>

/** Outcome of a namespace mutation. */
export type MutateNamespaceResult =
  | { ok: true }
  | { ok: false; reason: 'namespace-absent' | 'conflict' | 'error'; message: string }

/**
 * Apply path ops to one settings namespace under its current revision. It
 * describes settings to read the revision, so a missing namespace is reported
 * rather than blindly written, and a concurrent change is rejected as a
 * conflict the caller can surface.
 * @param settings - the settings wire face (describe + mutate).
 * @param ns - the settings namespace to write.
 * @param ops - the path-addressed edits to apply.
 * @returns whether the write landed, with a reason when it did not.
 */
export async function mutateNamespace(
  settings: SettingsMutateFace,
  ns: string,
  ops: readonly SettingsPathOpView[],
): Promise<MutateNamespaceResult> {
  let expectedRevision: number
  try {
    const described = await settings.describe({})
    if (!described.result.ok) return { ok: false, reason: 'error', message: described.result.error.message }
    const namespace = described.result.value.namespaces.find(view => view.ns === ns)
    if (namespace === undefined) return { ok: false, reason: 'namespace-absent', message: `settings namespace ${ns} is unavailable` }
    expectedRevision = namespace.revision
  } catch (error) {
    return { ok: false, reason: 'error', message: messageOf(error) }
  }

  try {
    const response = await settings.mutate({ ns, ops: [...ops], expectedRevision })
    if (response.result.ok) return { ok: true }
    return response.result.error.code === 'settings-conflict'
      ? { ok: false, reason: 'conflict', message: response.result.error.message }
      : { ok: false, reason: 'error', message: response.result.error.message }
  } catch (error) {
    return { ok: false, reason: 'error', message: messageOf(error) }
  }
}

/**
 * Human text for a rejected wire call: a transport failure rejects with an Error.
 * @param error - the rejection value; an Error contributes its message, anything else is stringified.
 * @returns the display message for the rejection.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
