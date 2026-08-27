import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import { CallId } from '@agentbrain-harness/llm'
import LocalFileSystem from '@agentbrain-harness/fs-local'
import SystemPrompt from '@agentbrain-harness/system-prompt'
import ToolRuntime from '@agentbrain-harness/tools'
import * as AgentBrainMemory from '../src/index.ts'

const signal = new AbortController().signal
let ctx: Context | undefined
let brain: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  if (brain !== undefined) await rm(brain, { recursive: true, force: true })
  ctx = undefined
  brain = undefined
})

async function setup(): Promise<void> {
  brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-'))
  await mkdir(join(brain, 'local', 'memories'), { recursive: true })
  await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: '/' })
  await ctx.plugin(AgentBrainMemory, { agentBrainHome: brain, fallbackVaultDir: join(brain, 'fallback'), maxRecallResults: 8, maxItemChars: 20000 })
}

async function execute(name: string, argumentsValue: object, callId: string) {
  return ctx!.tools.execute({ signal, callId: CallId(callId), name, arguments: argumentsValue })
}

describe('AgentBrain memory runtime', () => {
  it('saves canonical notes and recalls them from the shared vault', async () => {
    await setup()
    const saved = await execute('memory_save', { title: 'Deploy decisions', content: 'Deploy on Tuesdays.', tags: 'Ops' }, 'save')
    expect(saved.isError).toBe(false)
    const note = await readFile(join(brain!, 'local', 'memories', 'deploy-decisions.md'), 'utf8')
    expect(note).toContain('name: deploy-decisions')
    expect(note).toContain('node_type: memory')
    const recalled = await execute('memory_recall', { query: 'deploy tuesdays', tag: 'ops' }, 'recall')
    expect(recalled.isError).toBe(false)
    expect(recalled.value).toMatchObject({ memories: [{ title: 'Deploy decisions', content: 'Deploy on Tuesdays.' }] })
  })

  it('refuses writes while the canonical incognito flag exists', async () => {
    await setup()
    await mkdir(join(brain!, 'local', 'sessions'), { recursive: true })
    await writeFile(join(brain!, 'local', 'sessions', '.incognito'), '')
    const result = await execute('memory_save', { title: 'Blocked', content: 'Not persisted.' }, 'blocked')
    expect(result.isError).toBe(true)
    await expect(readFile(join(brain!, 'local', 'memories', 'blocked.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
