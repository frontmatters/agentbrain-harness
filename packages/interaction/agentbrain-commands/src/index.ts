/** Bridge AgentBrain user-invocable skills into ABH's command palette. */

import type { Context } from '@agentbrain-harness/cordis'
import type { CommandDefinition } from '@agentbrain-harness/commands'
import { createUserMessage } from '@agentbrain-harness/llm'
import { isUserInvocable, type SkillSummary } from '@agentbrain-harness/skill'

export const name = 'agentbrain-commands'
export const inject = ['commands', 'skills']

/** AgentBrain command-palette bridge configuration. */
export interface Config {
  /** Disable command-palette registration while retaining the skill provider. */
  enabled?: boolean
}

/** Register user-invocable AgentBrain skills as palette entries. */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  if (config.enabled === false) return
  let registrations = new Map<string, () => void>()
  let refreshVersion = 0

  const refresh = async (): Promise<void> => {
    const version = ++refreshVersion
    const skills = (await ctx.skills.list()).filter(isUserInvocable)
    if (version !== refreshVersion) return
    for (const dispose of registrations.values()) dispose()
    registrations = new Map<string, () => void>()
    for (const skill of skills) {
      const definition = definitionFor(skill)
      registrations.set(skill.name, ctx.commands.register(definition))
    }
  }

  await refresh()
  ctx.on('skills/change', () => { void refresh() })
  ctx.effect(() => () => {
    refreshVersion++
    for (const dispose of registrations.values()) dispose()
    registrations.clear()
  }, 'agentbrain-commands registrations')
}

function definitionFor(skill: SkillSummary): CommandDefinition {
  return {
    name: skill.name,
    description: skill.description,
    ...skill.argumentHint === undefined ? {} : { input: { hint: skill.argumentHint } },
    handler: ({ agent, rawInput, signal }) => {
      signal.throwIfAborted()
      agent.followup(createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: `/${skill.name}${rawInput}` }],
      }))
      return { kind: 'success', text: `Queued /${skill.name}.` }
    },
  }
}
