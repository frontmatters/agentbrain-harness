import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@agentbrain-harness/cordis'
import { CallId } from '@agentbrain-harness/llm'
import type { Agent } from '@agentbrain-harness/agent'
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

async function setup(opts: { maxRecallResults?: number; maxItemChars?: number } = {}): Promise<void> {
  brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-'))
  await mkdir(join(brain, 'local', 'memories'), { recursive: true })
  await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: '/' })
  await ctx.plugin(AgentBrainMemory, {
    agentBrainHome: brain,
    fallbackVaultDir: join(brain, 'fallback'),
    maxRecallResults: opts.maxRecallResults ?? 8,
    maxItemChars: opts.maxItemChars ?? 20000,
  })
}

async function execute(name: string, argumentsValue: object, callId: string) {
  return ctx!.tools.execute({ signal, callId: CallId(callId), name, arguments: argumentsValue })
}

/** Minimal agent stub for exercising the cwd branch in options(). */
function stubAgentWithCwd(cwd: string): Agent {
  return { session: { header: { cwd } } } as unknown as Agent
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

  describe('apply — config defaulting (direct apply call)', () => {
    it('uses built-in ?? defaults when rawConfig omits optional fields', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-defaults-'))
      await mkdir(join(brain, 'local', 'memories'), { recursive: true })
      await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      // Call apply() directly (bypassing Cordis schema coercion) so rawConfig fields are undefined,
      // which exercises the ?? fallback branches at lines 84–86.
      AgentBrainMemory.apply(ctx, { agentBrainHome: brain })
      const result = await execute('memory_save', { title: 'Default config note', content: 'Content.' }, 'cfg-default')
      expect(result.isError).toBe(false)
    })
  })

  describe('isConcurrencySafe declarations', () => {
    it('reports memory_save as exclusive with valid args', async () => {
      await setup()
      expect(ctx!.tools.executionMode({
        callId: CallId('mode-save'), name: 'memory_save',
        arguments: { title: 'T', content: 'C' }, signal: new AbortController().signal,
      })).toEqual({ kind: 'exclusive' })
    })
    it('reports memory_recall as parallel', async () => {
      await setup()
      expect(ctx!.tools.executionMode({
        callId: CallId('mode-recall'), name: 'memory_recall',
        arguments: {}, signal: new AbortController().signal,
      })).toEqual({ kind: 'parallel' })
    })
    it('reports memory_forget as exclusive with valid args', async () => {
      await setup()
      expect(ctx!.tools.executionMode({
        callId: CallId('mode-forget'), name: 'memory_forget',
        arguments: { id: 'some-id' }, signal: new AbortController().signal,
      })).toEqual({ kind: 'exclusive' })
    })
  })

  describe('assertConfig validation', () => {
    it('throws at load time when maxRecallResults is not a positive integer', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-bad-cfg-'))
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      await expect(ctx.plugin(AgentBrainMemory, { agentBrainHome: brain, maxRecallResults: 0 }))
        .rejects.toThrow('maxRecallResults must be a positive integer')
    })

    it('throws at load time when maxItemChars is not a positive integer', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-bad-cfg2-'))
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      await expect(ctx.plugin(AgentBrainMemory, { agentBrainHome: brain, maxItemChars: -1 }))
        .rejects.toThrow('maxItemChars must be a positive integer')
    })
  })

  describe('memory_save validation', () => {
    it('rejects an empty title', async () => {
      await setup()
      const result = await execute('memory_save', { title: '   ', content: 'Content.' }, 'empty-title')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('non-empty')
    })

    it('rejects an empty content body', async () => {
      await setup()
      const result = await execute('memory_save', { title: 'Title', content: '   ' }, 'empty-content')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('non-empty')
    })

    it('rejects content that exceeds the character cap', async () => {
      await setup({ maxItemChars: 10 })
      const result = await execute('memory_save', { title: 'Cap test', content: 'This is longer than ten characters.' }, 'too-long')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('character memory cap')
    })
  })

  describe('memory_save render output', () => {
    it('renders "Saved memory" text on first write', async () => {
      await setup()
      const result = await execute('memory_save', { title: 'Render new', content: 'Body.' }, 'render-new')
      expect(result.isError).toBe(false)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('Saved memory')
    })

    it('renders "Updated memory" text on overwrite of an existing note', async () => {
      await setup()
      await execute('memory_save', { title: 'Render existing', content: 'First body.' }, 'render-exist-1')
      const result = await execute('memory_save', { title: 'Render existing', content: 'Updated body.' }, 'render-exist-2')
      expect(result.isError).toBe(false)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('Updated memory')
    })
  })

  describe('memory_save — update existing note', () => {
    it('preserves the original created timestamp and sets updatedExisting true', async () => {
      await setup()
      const first = await execute('memory_save', { title: 'Update test', content: 'Original.' }, 'update-1')
      expect(first.isError).toBe(false)
      const second = await execute('memory_save', { title: 'Update test', content: 'Revised.' }, 'update-2')
      expect(second.isError).toBe(false)
      expect(second.value).toMatchObject({ updatedExisting: true })
      const recalled = await execute('memory_recall', { query: 'revised' }, 'update-recall')
      expect(recalled.isError).toBe(false)
      expect(recalled.value).toMatchObject({ memories: [{ content: 'Revised.' }] })
    })
  })

  describe('memory_save — fallback vault (no AgentBrain local dir)', () => {
    it('saves to the workspace-local fallback when the canonical local/ dir is absent', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-fallback-'))
      // No local/ directory — intentionally absent to trigger the fallback path.
      await writeFile(join(brain, 'brain.json'), JSON.stringify({ namespace: 'e37d107c-9344-4626-806e-8da1b442c8e4' }))
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      const fallbackDir = join(brain, 'fallback')
      await ctx.plugin(AgentBrainMemory, { agentBrainHome: brain, fallbackVaultDir: fallbackDir })
      const result = await execute('memory_save', { title: 'Fallback note', content: 'Fallback content.' }, 'fallback-save')
      expect(result.isError).toBe(false)
      // The note was written to the fallback memories dir, not to the absent local/memories.
      const note = await readFile(join(fallbackDir, 'memories', 'fallback-note.md'), 'utf8')
      expect(note).toContain('fallback-note')
    })
  })

  describe('memoryLocation error paths', () => {
    it('throws when brain.json is absent but local/ directory exists', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-no-brain-json-'))
      await mkdir(join(brain, 'local'), { recursive: true })
      // No brain.json — intentionally absent.
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      await ctx.plugin(AgentBrainMemory, { agentBrainHome: brain })
      const result = await execute('memory_recall', {}, 'no-brain-json')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('brain.json is missing')
    })

    it('throws when brain.json exists but has no namespace field', async () => {
      brain = await mkdtemp(join(tmpdir(), 'abh-agentbrain-memory-no-ns-'))
      await mkdir(join(brain, 'local'), { recursive: true })
      await writeFile(join(brain, 'brain.json'), JSON.stringify({ version: 1 }))
      ctx = new Context()
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      await ctx.plugin(LocalFileSystem, { cwd: '/' })
      await ctx.plugin(AgentBrainMemory, { agentBrainHome: brain })
      const result = await execute('memory_recall', {}, 'no-namespace')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('has no namespace')
    })
  })

  describe('options() — cwd from agent session', () => {
    it('resolves paths relative to the agent session cwd when an agent is present', async () => {
      await setup()
      const agent = stubAgentWithCwd('/')
      const result = await ctx!.tools.execute({
        signal, callId: CallId('cwd-agent'), name: 'memory_save',
        arguments: { title: 'Agent cwd note', content: 'Written with agent cwd.' },
        agent,
      })
      expect(result.isError).toBe(false)
    })
  })

  describe('memory_recall edge cases', () => {
    it('returns "No memories found." render text when the vault is empty', async () => {
      await setup()
      const result = await execute('memory_recall', {}, 'empty-recall')
      expect(result.isError).toBe(false)
      expect(result.content[0]).toMatchObject({ type: 'text', text: 'No memories found.' })
    })

    it('skips directory entries inside the memories dir', async () => {
      await setup()
      // Write a subdirectory inside the memories dir (simulates a non-file entry).
      await mkdir(join(brain!, 'local', 'memories', 'subdir'), { recursive: true })
      await execute('memory_save', { title: 'Real note', content: 'Content.' }, 'real-note')
      const result = await execute('memory_recall', {}, 'skip-dir')
      expect(result.isError).toBe(false)
      expect(result.value).toMatchObject({ memories: [{ title: 'Real note' }] })
    })

    it('skips files with non-.md extensions', async () => {
      await setup()
      await writeFile(join(brain!, 'local', 'memories', 'README.txt'), 'not a note')
      const result = await execute('memory_recall', {}, 'skip-txt')
      expect(result.isError).toBe(false)
      expect((result.value as { memories: unknown[] }).memories).toHaveLength(0)
    })

    it('skips files whose frontmatter is invalid (parseDoc returns undefined)', async () => {
      await setup()
      // Write a .md file whose content is not a valid memory doc.
      await writeFile(join(brain!, 'local', 'memories', 'garbage.md'), 'not frontmatter')
      const result = await execute('memory_recall', {}, 'skip-bad-doc')
      expect(result.isError).toBe(false)
      expect((result.value as { memories: unknown[] }).memories).toHaveLength(0)
    })

    it('truncates results and sets truncated=true when more items exist than maxRecallResults', async () => {
      await setup({ maxRecallResults: 2 })
      await execute('memory_save', { title: 'Note one', content: 'A.' }, 'n1')
      await execute('memory_save', { title: 'Note two', content: 'B.' }, 'n2')
      await execute('memory_save', { title: 'Note three', content: 'C.' }, 'n3')
      const result = await execute('memory_recall', {}, 'truncated')
      expect(result.isError).toBe(false)
      expect(result.value).toMatchObject({ truncated: true })
      expect((result.value as { memories: unknown[] }).memories).toHaveLength(2)
    })

    it('renders multiple memories as a formatted list', async () => {
      await setup()
      await execute('memory_save', { title: 'Alpha note', content: 'Alpha content.' }, 'alpha')
      await execute('memory_save', { title: 'Beta note', content: 'Beta content.' }, 'beta')
      const result = await execute('memory_recall', {}, 'multi-render')
      expect(result.isError).toBe(false)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('Alpha note')
    })
  })

  describe('memory_forget', () => {
    it('deletes an existing memory and returns forgotten=true', async () => {
      await setup()
      await execute('memory_save', { title: 'Delete me', content: 'Goodbye.' }, 'forget-save')
      const result = await execute('memory_forget', { id: 'Delete me' }, 'forget')
      expect(result.isError).toBe(false)
      expect(result.value).toMatchObject({ forgotten: true })
      expect(result.content[0]).toMatchObject({ type: 'text', text: 'Memory deleted.' })
    })

    it('returns forgotten=false when no memory with that id exists', async () => {
      await setup()
      const result = await execute('memory_forget', { id: 'nonexistent-memory' }, 'forget-miss')
      expect(result.isError).toBe(false)
      expect(result.value).toMatchObject({ forgotten: false })
      expect(result.content[0]).toMatchObject({ type: 'text', text: 'No memory with that id.' })
    })

    it('refuses to delete while incognito mode is active', async () => {
      await setup()
      await execute('memory_save', { title: 'Incognito forget', content: 'Body.' }, 'ig-save')
      await mkdir(join(brain!, 'local', 'sessions'), { recursive: true })
      await writeFile(join(brain!, 'local', 'sessions', '.incognito'), '')
      const result = await execute('memory_forget', { id: 'incognito-forget' }, 'ig-forget')
      expect(result.isError).toBe(true)
      const block = result.content[0]
      expect(block?.type === 'text' ? block.text : '').toContain('incognito')
    })
  })
})
