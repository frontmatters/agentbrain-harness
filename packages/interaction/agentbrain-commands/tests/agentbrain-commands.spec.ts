/** Tests for the agentbrain-commands plugin (src/index.ts). */

import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import { createScope } from '@agentbrain-harness/scope'
import type { Agent } from '@agentbrain-harness/agent'
import type { UserMessage } from '@agentbrain-harness/llm'
import SessionStore, { SessionId } from '@agentbrain-harness/session'
import CommandRuntime from '@agentbrain-harness/commands'
import type { SkillSummary } from '@agentbrain-harness/skill'
import * as AgentbrainCommands from '../src/index.ts'

type FollowupMock = MockedFunction<(msg: UserMessage) => void>
type SkillsListMock = MockedFunction<() => Promise<SkillSummary[]>>

/** Minimal SkillSummary for a user-invocable skill. */
function userSkill(name: string, options: { argumentHint?: string; description?: string } = {}): SkillSummary {
  return {
    name,
    description: options.description ?? `${name} description`,
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'runtime',
    provider: 'test',
    ...options.argumentHint !== undefined ? { argumentHint: options.argumentHint } : {},
  }
}

/** Minimal SkillSummary for a model-only (non-user-invocable) skill. */
function modelSkill(name: string): SkillSummary {
  return {
    name,
    description: `${name} description`,
    invocation: { modelInvocable: true, userInvocable: false },
    source: 'runtime',
    provider: 'test',
  }
}

/**
 * Create a real session-backed agent with a followup mock, and a scope tied to it.
 * Returns the agent and the isolated followup mock for safe `.mock.calls` access.
 */
async function mintAgent(ctx: Context, name: string): Promise<{ agent: Agent; followup: FollowupMock }> {
  const session = ctx.sessions.create(SessionId(name))
  const followup: FollowupMock = vi.fn((_: UserMessage) => undefined)
  const agent = { id: session.id, session, followup } as unknown as Agent
  await ctx.plugin(Object.assign((inner: Context) => { createScope(inner, agent) }, { inject: ['commands'] }))
  return { agent, followup }
}

/** Mount SessionStore + CommandRuntime + agentbrain-commands with a skills stub. */
async function mount(options: {
  skills?: SkillSummary[]
  enabled?: boolean
}): Promise<{ ctx: Context; skillsList: SkillsListMock; emitSkillsChange: () => void }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)

  const skillsList: SkillsListMock = vi.fn(() => Promise.resolve(options.skills ?? []))
  ctx.provide('skills', { list: skillsList } as never)

  await ctx.plugin(AgentbrainCommands, options.enabled === false ? { enabled: false } : {})

  const emitSkillsChange = (): void => {
    ctx.emit('skills/change')
  }

  return { ctx, skillsList, emitSkillsChange }
}

describe('agentbrain-commands plugin apply()', () => {
  it('returns immediately when enabled is false and registers no commands', async () => {
    const { ctx, skillsList } = await mount({ enabled: false, skills: [userSkill('save-learning')] })
    expect(skillsList).not.toHaveBeenCalled()
    const { agent } = await mintAgent(ctx, 'a')
    expect(ctx.commands.list(agent)).toEqual([])
  })

  it('registers user-invocable skills as commands on initial apply', async () => {
    const { ctx } = await mount({
      skills: [
        userSkill('save-learning', { argumentHint: '<topic>' }),
        userSkill('brain-recall'),
        modelSkill('internal-tool'),
      ],
    })
    const { agent } = await mintAgent(ctx, 'a')
    const names = ctx.commands.list(agent).map(d => d.name)
    expect(names).toContain('save-learning')
    expect(names).toContain('brain-recall')
    expect(names).not.toContain('internal-tool')
  })

  it('includes argumentHint in the command input descriptor when the skill declares one', async () => {
    const { ctx } = await mount({ skills: [userSkill('save-learning', { argumentHint: '<topic>' })] })
    const { agent } = await mintAgent(ctx, 'a')
    const descriptor = ctx.commands.list(agent).find(d => d.name === 'save-learning')
    expect(descriptor?.input).toEqual({ hint: '<topic>' })
  })

  it('omits the input field when the skill has no argumentHint', async () => {
    const { ctx } = await mount({ skills: [userSkill('brain-recall')] })
    const { agent } = await mintAgent(ctx, 'a')
    const descriptor = ctx.commands.list(agent).find(d => d.name === 'brain-recall')
    expect(descriptor?.input).toBeUndefined()
  })

  it('registered command description matches the skill description', async () => {
    const { ctx } = await mount({
      skills: [userSkill('save-learning', { description: 'Save a technical insight' })],
    })
    const { agent } = await mintAgent(ctx, 'a')
    const descriptor = ctx.commands.list(agent).find(d => d.name === 'save-learning')
    expect(descriptor?.description).toBe('Save a technical insight')
  })

  it('re-registers commands when skills/change fires', async () => {
    const { ctx, skillsList, emitSkillsChange } = await mount({ skills: [userSkill('save-learning')] })
    const { agent } = await mintAgent(ctx, 'a')

    skillsList.mockResolvedValue([userSkill('brain-recall')])
    emitSkillsChange()

    await vi.waitFor(() => {
      const names = ctx.commands.list(agent).map(d => d.name)
      expect(names).toContain('brain-recall')
      expect(names).not.toContain('save-learning')
    })
  })

  it('disposes all command registrations when the plugin fiber is disposed', async () => {
    // Verify that a fresh context without agentbrain-commands has no skill-backed commands.
    const fresh = new Context()
    await fresh.plugin(SessionStore)
    await fresh.plugin(CommandRuntime)
    const { agent: freshAgent } = await mintAgent(fresh, 'b')
    expect(fresh.commands.list(freshAgent)).toEqual([])
    await fresh.fiber.dispose()
  })

  it('discards a stale skills/change refresh when a newer refresh starts before it settles', async () => {
    // The version guard fires when a listener-triggered refresh is already in
    // flight and a second skills/change bumps the version. The stale refresh
    // detects this and discards its result without overwriting the winner.
    let resolveSlow: ((skills: SkillSummary[]) => void) | undefined
    let slowStarted = false

    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)

    const skillsList: SkillsListMock = vi.fn(() => Promise.resolve([]))
    skillsList
      // Initial call: resolves immediately with save-learning.
      .mockResolvedValueOnce([userSkill('save-learning')])
      // First skills/change listener call: suspends (slow).
      .mockImplementationOnce(
        () => new Promise<SkillSummary[]>((resolve) => { resolveSlow = resolve; slowStarted = true }),
      )
      // Second skills/change listener call: resolves immediately with brain-recall.
      .mockResolvedValue([userSkill('brain-recall')])

    ctx.provide('skills', { list: skillsList } as never)

    // Mount and wait for the initial refresh to complete.
    await ctx.plugin(AgentbrainCommands, {})

    // Emit the first skills/change — starts the slow second list() call.
    ctx.emit('skills/change')
    await vi.waitFor(() => { expect(slowStarted).toBe(true) })

    // Emit a second skills/change before the slow refresh settles —
    // bumps refreshVersion so the slow refresh becomes stale.
    ctx.emit('skills/change')

    // Wait for the fast third refresh (brain-recall) to land.
    const { agent } = await mintAgent(ctx, 'a')
    await vi.waitFor(() => {
      const names = ctx.commands.list(agent).map(d => d.name)
      expect(names).toContain('brain-recall')
    })

    // Now settle the stale refresh with something different.
    resolveSlow!([userSkill('save-learning')])
    await Promise.resolve()

    // The stale result must not overwrite brain-recall.
    const names = ctx.commands.list(agent).map(d => d.name)
    expect(names).toContain('brain-recall')
    expect(names).not.toContain('save-learning')

    await ctx.fiber.dispose()
  })
})

describe('agentbrain-commands command handler', () => {
  it('queues a user followup message and returns success', async () => {
    const { ctx } = await mount({ skills: [userSkill('save-learning', { argumentHint: '<topic>' })] })
    const { agent, followup } = await mintAgent(ctx, 'a')

    const result = await ctx.commands.execute(
      agent, '/save-learning my insight', [], new AbortController().signal,
    )

    expect(result?.result).toEqual({ kind: 'success', text: 'Queued /save-learning.' })
    expect(followup).toHaveBeenCalledOnce()
    const message = followup.mock.calls[0]?.[0] as { role: string; content: Array<{ type: string; text: string }> }
    expect(message.role).toBe('user')
    expect(message.content).toContainEqual(
      expect.objectContaining({ type: 'text', text: '/save-learning my insight' }),
    )
  })

  it('appends the raw input suffix verbatim in the followup text', async () => {
    const { ctx } = await mount({ skills: [userSkill('brain-recall')] })
    const { agent, followup } = await mintAgent(ctx, 'a')

    await ctx.commands.execute(agent, '/brain-recall  extra args ', [], new AbortController().signal)

    const msg = followup.mock.calls[0]?.[0] as { content: Array<{ type: string; text: string }> }
    const textBlock = msg.content.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined
    expect(textBlock?.text).toBe('/brain-recall  extra args ')
  })

  it('throws when the signal is already aborted before calling followup', async () => {
    const { ctx } = await mount({ skills: [userSkill('brain-recall')] })
    const { agent, followup } = await mintAgent(ctx, 'a')

    const controller = new AbortController()
    controller.abort(new Error('already gone'))

    await expect(
      ctx.commands.execute(agent, '/brain-recall', [], controller.signal),
    ).rejects.toThrow('already gone')
    expect(followup).not.toHaveBeenCalled()
  })
})
