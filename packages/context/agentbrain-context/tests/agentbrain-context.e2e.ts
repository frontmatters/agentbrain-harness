import { createUserMessage } from '@agentbrain-harness/llm'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import LlmRuntime from '@agentbrain-harness/llm'
import SessionStore, { SessionId } from '@agentbrain-harness/session'
import SystemPrompt from '@agentbrain-harness/system-prompt'
import ToolRuntime from '@agentbrain-harness/tools'
import AgentRegistry from '@agentbrain-harness/agent'
import AgentLoop from '@agentbrain-harness/agent-loop'
import * as LlmDeepSeek from '@agentbrain-harness/llm-deepseek'
import LocalFileSystem from '@agentbrain-harness/fs-local'
import * as AgentBrainContext from '@agentbrain-harness/agentbrain-context'
import type { Agent } from '@agentbrain-harness/agent'
import type { SessionEvent } from '@agentbrain-harness/session'

const PROBE = 'agentbrain-context-271828'
let ctx: Context | undefined
let workdir: string | undefined
let brain: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  if (workdir !== undefined) await rm(workdir, { recursive: true, force: true })
  if (brain !== undefined) await rm(brain, { recursive: true, force: true })
  ctx = undefined
  workdir = undefined
  brain = undefined
})

async function harness(): Promise<{ agent: Agent }> {
  workdir = await mkdtemp(join(tmpdir(), 'abh-agentbrain-context-workspace-'))
  brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-context-brain-'))
  await mkdir(join(workdir, '.git'), { recursive: true })
  await mkdir(join(brain, 'local', 'projects', workdir.split('/').pop()!), { recursive: true })
  await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
  await mkdir(join(brain, 'local'), { recursive: true })
  await mkdir(join(brain, 'system'), { recursive: true })
  await writeFile(join(brain, 'system', 'rules.md'), `If the user asks for the AgentBrain context handshake, reply with exactly ${PROBE}.\n`)
  ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: 'Answer the user exactly and concisely.' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LocalFileSystem, { cwd: '/' })
  await ctx.plugin(AgentBrainContext, { agentBrainHome: brain, maxBytes: 50000, maxProjectBytes: 80000, includePreferences: true })
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(LlmDeepSeek, { models: [{ id: 'deepseek-v4-flash' }] })
  const handle = await ctx.agents.create({ sessionId: SessionId('agentbrain-context-e2e-session'), meta: { cwd: workdir }, agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } })
  return { agent: handle.agent }
}

function waitForIdle(agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx!.on('agent/status', (event) => {
      if (event.agent === agent && event.status === 'idle') { dispose(); resolve() }
    })
  })
}

function finalText(events: readonly SessionEvent[]): string {
  const message = events.findLast(event => event.type === 'assistant/message')
  return message?.type === 'assistant/message' ? message.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('') : ''
}

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('AgentBrain context e2e', () => {
  it('makes canonical rules visible to the model', async () => {
    const live = await harness()
    live.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'AgentBrain context handshake?' }], source: { kind: 'user' } }))
    await waitForIdle(live.agent)
    expect(finalText([...live.agent.session.events])).toContain(PROBE)
  }, 120_000)
})
