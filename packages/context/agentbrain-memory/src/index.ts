/** AgentBrain shared-vault memory tools with an agent-agnostic workspace fallback. */

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@agentbrain-harness/cordis'
import z from '@agentbrain-harness/schemastery'
import { resolveAgentBrainHome } from '@agentbrain-harness/home-paths'
import { defineTool, type ToolExecution } from '@agentbrain-harness/tools'
import type { FsTarget } from '@agentbrain-harness/fs'
import type {} from '@agentbrain-harness/system-prompt'
import {
  fileNameToId, idToFileName, matchesQuery, normalizeTags, parseDoc, renderDoc, slugify, uuid5, type MemoryDoc,
} from './vault.ts'

export { fileNameToId, idToFileName, matchesQuery, normalizeTags, parseDoc, renderDoc, slugify, uuid5 }
export type { MemoryDoc } from './vault.ts'

export const name = 'agentbrain-memory'
export const inject = ['tools', 'systemPrompt', 'fs']

const DEFAULT_MAX_RECALL_RESULTS = 8
const DEFAULT_MAX_ITEM_CHARS = 20_000
const MEMORY_RELATIVE_PREFIX = 'local/memories/'

/** AgentBrain memory configuration. */
export interface Config {
  /** Explicit AgentBrain checkout. Defaults to the canonical AgentBrain environment contract. */
  agentBrainHome?: string
  /** Workspace fallback directory when no AgentBrain checkout is available. */
  fallbackVaultDir?: string
  /** Maximum number of memories returned by one recall. */
  maxRecallResults?: number
  /** Maximum body size accepted by save. */
  maxItemChars?: number
}

export const Config: z<Config> = z.object({
  agentBrainHome: z.string(),
  fallbackVaultDir: z.string().default('.agentbrain'),
  maxRecallResults: z.number().default(DEFAULT_MAX_RECALL_RESULTS),
  maxItemChars: z.number().default(DEFAULT_MAX_ITEM_CHARS),
})

type ResolvedConfig = Required<Config>
type MemoryLocation = { readonly dir: FsTarget; readonly canonical: boolean; readonly namespace?: string; readonly incognito: boolean }

function assertConfig(config: ResolvedConfig): void {
  const values: readonly [string, number][] = [
    ['maxRecallResults', config.maxRecallResults],
    ['maxItemChars', config.maxItemChars],
  ]
  for (const [name, value] of values) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`agentbrain-memory: ${name} must be a positive integer`)
  }
}

function options(exec: ToolExecution): { cwd?: string; signal?: AbortSignal } {
  const cwd = exec.agent?.session.header.cwd
  return { ...(cwd === undefined ? {} : { cwd }), signal: exec.signal }
}

async function memoryLocation(ctx: Context, config: ResolvedConfig, exec: ToolExecution): Promise<MemoryLocation> {
  const localRoot = await ctx.fs.resolve(join(config.agentBrainHome, 'local'), options(exec))
  if (await ctx.fs.stat(localRoot, exec.signal) === undefined) {
    return { dir: await ctx.fs.resolve(join(config.fallbackVaultDir, 'memories'), options(exec)), canonical: false, incognito: false }
  }
  const brainConfigPath = await ctx.fs.resolve(join(config.agentBrainHome, 'brain.json'), options(exec))
  if (await ctx.fs.stat(brainConfigPath, exec.signal) === undefined) throw new Error(`AgentBrain brain.json is missing at ${config.agentBrainHome}`)
  const parsed = JSON.parse(await ctx.fs.readText(brainConfigPath, exec.signal)) as { namespace?: unknown }
  if (typeof parsed.namespace !== 'string') throw new Error(`AgentBrain brain.json has no namespace at ${config.agentBrainHome}`)
  const incognitoFlag = await ctx.fs.resolve(join(config.agentBrainHome, 'local', 'sessions', '.incognito'), options(exec))
  return {
    dir: await ctx.fs.resolve(join(config.agentBrainHome, 'local', 'memories'), options(exec)),
    canonical: true,
    namespace: parsed.namespace,
    incognito: await ctx.fs.stat(incognitoFlag, exec.signal) !== undefined,
  }
}

/** Register shared AgentBrain memory tools; fallback remains workspace-local. */
export function apply(ctx: Context, rawConfig: Config = {}): void {
  const config: ResolvedConfig = {
    agentBrainHome: resolveAgentBrainHome(rawConfig.agentBrainHome),
    fallbackVaultDir: rawConfig.fallbackVaultDir ?? '.agentbrain',
    maxRecallResults: rawConfig.maxRecallResults ?? DEFAULT_MAX_RECALL_RESULTS,
    maxItemChars: rawConfig.maxItemChars ?? DEFAULT_MAX_ITEM_CHARS,
  }
  assertConfig(config)
  ctx.systemPrompt.section({
    name: 'agentbrain-memory', order: 120,
    text: 'When an AgentBrain vault is available, memory_save, memory_recall, and memory_forget use its canonical local/memories notes. Otherwise they use the workspace-local fallback. Recall relevant memories before work and save durable facts, preferences, and decisions.',
  })

  ctx.tools.register(defineTool({
    name: 'memory_save',
    description: 'Save a durable memory in the canonical AgentBrain vault or workspace fallback.',
    parameters: { title: { type: 'string', required: true, description: 'Short memory title.' }, content: { type: 'string', required: true, description: 'Memory body in Markdown.' }, tags: { type: 'string', description: 'Comma-separated tags.' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', required: true }, updatedExisting: { type: 'boolean', required: true } } }, render: (_args, value) => [{ type: 'text', text: `${value.updatedExisting ? 'Updated' : 'Saved'} memory "${value.id}".` }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const title = args.title.trim()
      const content = args.content.trim()
      if (!title || !content) throw new Error('title and content must be non-empty')
      if (args.content.length > config.maxItemChars) throw new Error(`content exceeds the ${config.maxItemChars}-character memory cap`)
      const name = slugify(title)
      const location = await memoryLocation(ctx, config, exec)
      if (location.incognito) throw new Error('Refusing to write: AgentBrain is in incognito mode')
      const id = location.canonical && location.namespace !== undefined ? uuid5(location.namespace, `${MEMORY_RELATIVE_PREFIX}${name}`) : name
      const target = await ctx.fs.resolve(join(location.dir.displayPath, idToFileName(name)), options(exec))
      const existing = await ctx.fs.stat(target, exec.signal)
      const previous = existing === undefined ? undefined : parseDoc(name, await ctx.fs.readText(target, exec.signal))
      const now = new Date().toISOString()
      const doc: MemoryDoc = {
        id: location.canonical ? id : previous?.id || id,
        name,
        description: title,
        tags: normalizeTags(args.tags),
        created: previous?.created ?? now,
        updated: now,
        content,
      }
      exec.signal.throwIfAborted()
      await mkdir(location.dir.displayPath, { recursive: true })
      await writeFile(target.displayPath, renderDoc(doc), 'utf8')
      exec.signal.throwIfAborted()
      return { id: doc.id, updatedExisting: previous !== undefined }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_recall',
    description: 'Search canonical AgentBrain memories; omit filters to list recent memories.',
    parameters: {
      query: { type: 'string', description: 'All terms must occur in the memory.' },
      tag: { type: 'string', description: 'Exact tag filter.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          memories: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                tags: { type: 'string', required: true },
                updated: { type: 'string', required: true },
                content: { type: 'string', required: true },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.memories.length === 0
          ? 'No memories found.'
          : value.memories
            .map(memory => `- ${memory.title} [${memory.id}]\n${memory.content}`)
            .join('\n\n'),
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const location = await memoryLocation(ctx, config, exec)
      const docs: MemoryDoc[] = []
      for (const entry of await ctx.fs.listDir(location.dir, exec.signal)) {
        if (entry.type !== 'file') continue
        const name = fileNameToId(entry.name)
        if (name === undefined) continue
        const doc = parseDoc(name, await ctx.fs.readText(entry.target, exec.signal))
        if (doc !== undefined && matchesQuery(doc, args.query, args.tag)) docs.push(doc)
      }
      docs.sort((left, right) => right.updated.localeCompare(left.updated))
      return {
        memories: docs.slice(0, config.maxRecallResults).map(doc => ({
          id: doc.id,
          title: doc.description,
          tags: doc.tags,
          updated: doc.updated,
          content: doc.content,
        })),
        truncated: docs.length > config.maxRecallResults,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_forget',
    description: 'Delete one memory by name from the canonical AgentBrain vault or fallback.',
    parameters: { id: { type: 'string', required: true, description: 'Memory name or id.' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { forgotten: { type: 'boolean', required: true } } }, render: (_args, value) => [{ type: 'text', text: value.forgotten ? 'Memory deleted.' : 'No memory with that id.' }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const name = slugify(args.id.trim())
      const location = await memoryLocation(ctx, config, exec)
      if (location.incognito) throw new Error('Refusing to write: AgentBrain is in incognito mode')
      const target = await ctx.fs.resolve(join(location.dir.displayPath, idToFileName(name)), options(exec))
      if (await ctx.fs.stat(target, exec.signal) === undefined) return { forgotten: false }
      exec.signal.throwIfAborted()
      await unlink(target.displayPath)
      exec.signal.throwIfAborted()
      return { forgotten: true }
    },
  }))
}
