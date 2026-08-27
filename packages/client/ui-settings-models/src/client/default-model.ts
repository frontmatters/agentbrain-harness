/**
 * Default-model write path for onboarding and any model chooser. The selection
 * lives in the `agent-default-model` settings namespace, which no other client
 * surface wrote before. This module builds that namespace's edit and delegates
 * the concurrency-guarded write to {@link mutateNamespace}.
 *
 * @module @agentbrain-harness/client-ui-settings-models/default-model
 */

import type { SettingsPathOpView } from '@agentbrain-harness/api-remotes/client'
import { mutateNamespace } from './settings-mutate.ts'
import type { MutateNamespaceResult, SettingsMutateFace } from './settings-mutate.ts'

/** The settings namespace that holds the agent's default provider route and model. */
export const AGENT_DEFAULT_MODEL_NAMESPACE = 'agent-default-model'

/** A provider route and model the agent should default to. */
export interface DefaultModelSelection {
  /** The provider route id (e.g. `default`, `local`). */
  provider: string
  /** The model id served by that route. */
  model: string
  /** Optional reasoning-effort id; omitted leaves the field unset. */
  reasoningEffort?: string
}

/** Outcome of a default-model write. */
export type WriteDefaultModelResult = MutateNamespaceResult

/**
 * Persist the agent's default provider route and model into the
 * `agent-default-model` namespace.
 * @param settings - the settings wire face (describe + mutate).
 * @param selection - the provider route, model, and optional reasoning effort.
 * @returns whether the write landed, with a reason when it did not.
 */
export async function writeDefaultModel(
  settings: SettingsMutateFace,
  selection: DefaultModelSelection,
): Promise<WriteDefaultModelResult> {
  const ops: SettingsPathOpView[] = [
    { op: 'set', path: ['provider'], value: selection.provider },
    { op: 'set', path: ['model'], value: selection.model },
  ]
  if (selection.reasoningEffort !== undefined) {
    ops.push({ op: 'set', path: ['reasoningEffort'], value: selection.reasoningEffort })
  }
  return mutateNamespace(settings, AGENT_DEFAULT_MODEL_NAMESPACE, ops)
}
